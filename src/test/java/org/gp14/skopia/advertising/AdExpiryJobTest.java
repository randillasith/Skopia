package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.CampaignRequest;
import org.gp14.skopia.model.advertisement.AdCampaign;
import org.gp14.skopia.model.user.MarketingOfficer;
import org.gp14.skopia.repository.AdCampaignRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The sweep that keeps {@code campaign_status} honest.
 *
 * <p>Note what is *not* asserted here: that the sweep stops an expired advertisement
 * being shown. It does not — {@link AdServingServiceTest} covers that, and covers it
 * without the sweep having run at all. The sweep only makes the stored column agree
 * with the calendar, which is what a report written against the tables reads.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdExpiryJobTest {

    @Autowired AdExpiryJob expiry;
    @Autowired AdCampaignRepository campaigns;
    @Autowired AdCampaignService service;
    @Autowired AdvertisingFixture fixture;

    private MarketingOfficer officer;

    @BeforeEach
    void setUp() {
        officer = fixture.officer();
    }

    @Test
    @DisplayName("a campaign past its end date is marked expired")
    void expiresWhatHasLapsed() {
        LocalDateTime now = LocalDateTime.now();
        AdCampaign lapsed = stored("Midsummer Shorts", now.minusDays(60), now.minusMinutes(1),
                CampaignStatus.ACTIVE);

        assertThat(expiry.run()).isEqualTo(1);
        assertThat(campaigns.findById(lapsed.getId()).orElseThrow().getCampaignStatus())
                .isEqualTo(CampaignStatus.EXPIRED);
    }

    @Test
    @DisplayName("a campaign that has reached its start date is marked active")
    void startsWhatHasBegun() {
        LocalDateTime now = LocalDateTime.now();
        AdCampaign begun = stored("Autumn Season Launch", now.minusHours(2), now.plusDays(20),
                CampaignStatus.SCHEDULED);

        assertThat(expiry.run()).isEqualTo(1);
        assertThat(campaigns.findById(begun.getId()).orElseThrow().getCampaignStatus())
                .isEqualTo(CampaignStatus.ACTIVE);
    }

    @Test
    @DisplayName("a status somebody chose is left alone")
    void leavesChosenStatusesAlone() {
        LocalDateTime now = LocalDateTime.now();
        AdCampaign paused = stored("Basement Tapes", now.minusDays(2), now.minusMinutes(1),
                CampaignStatus.PAUSED);
        AdCampaign draft = stored("Winter Push", now.minusDays(2), now.minusMinutes(1),
                CampaignStatus.DRAFT);
        AdCampaign archived = stored("Last Spring", now.minusDays(90), now.minusDays(60),
                CampaignStatus.ARCHIVED);

        assertThat(expiry.run()).isZero();
        assertThat(campaigns.findById(paused.getId()).orElseThrow().getCampaignStatus())
                .isEqualTo(CampaignStatus.PAUSED);
        assertThat(campaigns.findById(draft.getId()).orElseThrow().getCampaignStatus())
                .isEqualTo(CampaignStatus.DRAFT);
        assertThat(campaigns.findById(archived.getId()).orElseThrow().getCampaignStatus())
                .isEqualTo(CampaignStatus.ARCHIVED);
    }

    @Test
    @DisplayName("running the sweep twice changes nothing the second time")
    void isIdempotent() {
        LocalDateTime now = LocalDateTime.now();
        stored("Midsummer Shorts", now.minusDays(60), now.minusMinutes(1), CampaignStatus.ACTIVE);

        assertThat(expiry.run()).isEqualTo(1);
        assertThat(expiry.run()).isZero();
    }

    @Test
    @DisplayName("a campaign still inside its window is untouched")
    void leavesRunningCampaignsAlone() {
        LocalDateTime now = LocalDateTime.now();
        AdCampaign running = stored("Cadence Hall", now.minusDays(1), now.plusDays(9),
                CampaignStatus.ACTIVE);

        assertThat(expiry.run()).isZero();
        assertThat(campaigns.findById(running.getId()).orElseThrow().getCampaignStatus())
                .isEqualTo(CampaignStatus.ACTIVE);
    }

    /**
     * Write a campaign row directly, at a status the service would not let you
     * reach by hand — the point is to test the sweep, not the transitions.
     */
    private AdCampaign stored(String name, LocalDateTime start, LocalDateTime end,
                              CampaignStatus status) {
        AdCampaign campaign = new AdCampaign();
        campaign.setCreatedBy(officer);
        campaign.setCampaignName(name);
        campaign.setAdvertiser("Meridian Films");
        campaign.setStartDate(start);
        campaign.setEndDate(end);
        campaign.setBudget(BigDecimal.ZERO);
        campaign.setCampaignStatus(status);
        return campaigns.save(campaign);
    }
}
