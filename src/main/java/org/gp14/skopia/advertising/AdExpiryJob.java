package org.gp14.skopia.advertising;

import org.gp14.skopia.model.advertisement.AdCampaign;
import org.gp14.skopia.repository.AdCampaignRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Keeps the stored campaign status in step with the calendar.
 *
 * <p>This sweep is a convenience, not the safety net. Delivery already refuses an
 * advertisement outside its window — {@link AdServingService} re-checks the dates on
 * every request — and the API already returns the derived status. What the sweep
 * buys is a database whose {@code campaign_status} column means what it says, so a
 * report written straight against the tables, or a colleague reading the rows in
 * MySQL Workbench, sees the same thing the application does.
 *
 * <p>Because of that separation, a failed or skipped run cannot show an expired
 * advertisement to a viewer. It can only leave a row looking out of date.
 */
@Component
public class AdExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(AdExpiryJob.class);

    private final AdCampaignRepository campaigns;

    public AdExpiryJob(AdCampaignRepository campaigns) {
        this.campaigns = campaigns;
    }

    @Scheduled(cron = "${skopia.ads.expiry.cron:0 */5 * * * *}")
    public void sweep() {
        int changed = run();
        if (changed > 0) {
            log.info("FR5 expiry sweep updated {} campaign status(es)", changed);
        }
    }

    /**
     * Run the sweep once, and say how many rows moved.
     *
     * <p>Split out from the schedule so a test — and the "run it now" endpoint the
     * campaign screen offers — can trigger it without waiting for the cron.
     */
    @Transactional
    public int run() {
        LocalDateTime now = LocalDateTime.now();
        int changed = 0;

        List<AdCampaign> lapsed = campaigns.findLapsed(now);
        for (AdCampaign campaign : lapsed) {
            campaign.setCampaignStatus(CampaignStatus.EXPIRED);
            changed++;
        }
        campaigns.saveAll(lapsed);

        // The other direction, and the reason this is not called "the expiry job"
        // in the code: a campaign that reached its start date is just as wrong
        // sitting at SCHEDULED as an ended one is sitting at ACTIVE.
        List<AdCampaign> started = campaigns.findStarted(now);
        for (AdCampaign campaign : started) {
            campaign.setCampaignStatus(CampaignStatus.ACTIVE);
            changed++;
        }
        campaigns.saveAll(started);

        return changed;
    }
}
