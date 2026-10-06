package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.MetricBreakdownRow;
import org.gp14.skopia.advertising.dto.MetricPointRow;
import org.gp14.skopia.advertising.dto.MetricTotalsRow;
import org.gp14.skopia.advertising.dto.MetricsResponse;
import org.gp14.skopia.model.advertisement.AdCampaign;
import org.gp14.skopia.model.advertisement.Advertisement;
import org.gp14.skopia.repository.AdCampaignRepository;
import org.gp14.skopia.repository.AdImpressionRepository;
import org.gp14.skopia.repository.AdvertisementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Performance: impressions, clicks and CTR, per campaign and per advertisement.
 *
 * <p>Figures are computed from the raw impression log on request rather than from a
 * nightly rollup table. At Skopia's scale that is the right trade — the aggregates
 * are indexed {@code GROUP BY}s, and a rollup would add a whole class of bug where
 * the dashboard and the underlying rows disagree until somebody re-runs a job. The
 * queries are all in one repository, so the day the log outgrows this, the change
 * is to swap their bodies for reads of a summary table and nothing above here moves.
 *
 * <p>CTR is computed once, in {@link AdCampaignService#ctr}, and never recomputed in
 * the UI: two definitions of the same percentage is how a dashboard and a report
 * end up disagreeing about the same campaign.
 */
@Service
public class AdAnalyticsService {

    /** The breakdowns a campaign dashboard shows, in the order it shows them. */
    private static final List<String> CAMPAIGN_DIMENSIONS = List.of("video", "category", "device", "slot");

    private final AdImpressionRepository impressions;
    private final AdCampaignRepository campaigns;
    private final AdvertisementRepository advertisements;
    private final AdvertisingAccess access;

    public AdAnalyticsService(AdImpressionRepository impressions,
                              AdCampaignRepository campaigns,
                              AdvertisementRepository advertisements,
                              AdvertisingAccess access) {
        this.impressions = impressions;
        this.campaigns = campaigns;
        this.advertisements = advertisements;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public MetricsResponse forCampaign(Long actorId, Long campaignId, LocalDate from, LocalDate to) {
        access.require(actorId);
        AdCampaign campaign = campaigns.findById(campaignId)
                .orElseThrow(() -> AdvertisingException.notFound("Campaign", campaignId));

        Window window = Window.of(from, to);
        MetricTotalsRow totals = impressions.totalsForCampaign(campaignId, window.start(), window.end());
        List<MetricPointRow> daily = impressions.dailyForCampaign(campaignId, window.start(), window.end());

        List<MetricsResponse.Breakdown> breakdowns = new ArrayList<>();
        for (String dimension : CAMPAIGN_DIMENSIONS) {
            breakdowns.add(breakdown(dimension,
                    impressions.breakdownForCampaign(campaignId, dimension, window.start(), window.end())));
        }
        breakdowns.add(breakdown("advertisement",
                impressions.byAdvertisement(campaignId, window.start(), window.end())));

        return assemble("campaign", campaignId, campaign.getCampaignName(), window, totals, daily, breakdowns);
    }

    @Transactional(readOnly = true)
    public MetricsResponse forAdvertisement(Long actorId, Long adId, LocalDate from, LocalDate to) {
        access.require(actorId);
        Advertisement ad = advertisements.findById(adId)
                .orElseThrow(() -> AdvertisingException.notFound("Advertisement", adId));

        Window window = Window.of(from, to);
        MetricTotalsRow totals = impressions.totalsForAd(adId, window.start(), window.end());
        List<MetricPointRow> daily = impressions.dailyForAd(adId, window.start(), window.end());

        return assemble("advertisement", adId, ad.getAdTitle(), window, totals, daily, List.of());
    }

    /**
     * The same figures as a spreadsheet.
     *
     * <p>CSV rather than XLSX: it opens in Excel, Numbers and Sheets without a
     * library, and the export is a table of numbers with no formatting to lose.
     */
    @Transactional(readOnly = true)
    public String csvForCampaign(Long actorId, Long campaignId, LocalDate from, LocalDate to) {
        MetricsResponse metrics = forCampaign(actorId, campaignId, from, to);
        StringBuilder csv = new StringBuilder();

        csv.append("Campaign,").append(escape(metrics.subjectName())).append('\n');
        csv.append("From,").append(metrics.from()).append('\n');
        csv.append("To,").append(metrics.to()).append('\n');
        csv.append("Impressions,").append(metrics.impressions()).append('\n');
        csv.append("Clicks,").append(metrics.clicks()).append('\n');
        csv.append("CTR %,").append(metrics.ctr()).append("\n\n");

        csv.append("Date,Impressions,Clicks,CTR %\n");
        for (MetricsResponse.Point p : metrics.daily()) {
            csv.append(p.day()).append(',').append(p.impressions()).append(',')
               .append(p.clicks()).append(',').append(p.ctr()).append('\n');
        }

        for (MetricsResponse.Breakdown b : metrics.breakdowns()) {
            if (b.rows().isEmpty()) continue;
            csv.append('\n').append("By ").append(b.dimension()).append('\n');
            csv.append("Label,Impressions,Clicks,CTR %\n");
            for (MetricsResponse.Breakdown.Row r : b.rows()) {
                csv.append(escape(r.label())).append(',').append(r.impressions()).append(',')
                   .append(r.clicks()).append(',').append(r.ctr()).append('\n');
            }
        }
        return csv.toString();
    }

    @Transactional(readOnly = true)
    public String csvForAdvertisement(Long actorId, Long adId, LocalDate from, LocalDate to) {
        MetricsResponse metrics = forAdvertisement(actorId, adId, from, to);
        StringBuilder csv = new StringBuilder();
        csv.append("Advertisement,").append(escape(metrics.subjectName())).append('\n');
        csv.append("From,").append(metrics.from()).append('\n');
        csv.append("To,").append(metrics.to()).append('\n');
        csv.append("Impressions,").append(metrics.impressions()).append('\n');
        csv.append("Clicks,").append(metrics.clicks()).append('\n');
        csv.append("CTR %,").append(metrics.ctr()).append("\n\n");
        csv.append("Date,Impressions,Clicks,CTR %\n");
        for (MetricsResponse.Point p : metrics.daily()) {
            csv.append(p.day()).append(',').append(p.impressions()).append(',')
               .append(p.clicks()).append(',').append(p.ctr()).append('\n');
        }
        return csv.toString();
    }

    /* ------------------------------------------------------------ internals */

    private MetricsResponse assemble(String subject, Long id, String name, Window window,
                                     MetricTotalsRow totals, List<MetricPointRow> daily,
                                     List<MetricsResponse.Breakdown> breakdowns) {
        long shown = totals == null ? 0 : totals.impressions();
        long clicked = totals == null ? 0 : totals.clickCount();

        List<MetricsResponse.Point> points = daily.stream()
                .map(p -> new MetricsResponse.Point(p.day(), p.impressions(), p.clickCount(),
                        AdCampaignService.ctr(p.impressions(), p.clickCount())))
                .toList();

        return new MetricsResponse(subject, id, name, window.from, window.to,
                shown, clicked, AdCampaignService.ctr(shown, clicked), points, breakdowns);
    }

    private MetricsResponse.Breakdown breakdown(String dimension, List<MetricBreakdownRow> rows) {
        return new MetricsResponse.Breakdown(dimension, rows.stream()
                .map(r -> new MetricsResponse.Breakdown.Row(r.label(), r.impressions(), r.clickCount(),
                        AdCampaignService.ctr(r.impressions(), r.clickCount())))
                .toList());
    }

    /** Quote a CSV field only when it would otherwise break the row. */
    /**
     * One field, safe to put in a spreadsheet.
     *
     * <p>Two separate problems. Quoting keeps a comma or a newline inside its own
     * field — that one is about the file parsing correctly.
     *
     * <p>The other is that Excel, Numbers and Sheets all treat a cell beginning
     * {@code =}, {@code +}, {@code -} or {@code @} as a formula and evaluate it on
     * open. These exports carry campaign names, advertiser names and video titles,
     * all of them typed by people, and a title like
     * {@code =HYPERLINK("http://example.invalid","Results")} becomes a live link in
     * the officer's spreadsheet rather than the name of a video. Prefixing a quote
     * makes the cell read as text; the leading quote is not shown by any of the
     * three.
     */
    private static String escape(String value) {
        if (value == null) return "";
        String safe = FORMULA_STARTERS.indexOf(value.isEmpty() ? ' ' : value.charAt(0)) >= 0
                ? "'" + value
                : value;
        if (safe.contains(",") || safe.contains("\"") || safe.contains("\n") || safe.contains("\r")) {
            return '"' + safe.replace("\"", "\"\"") + '"';
        }
        return safe;
    }

    /** Characters a spreadsheet reads as "this cell is a formula". */
    private static final String FORMULA_STARTERS = "=+-@\t\r";

    /**
     * An inclusive date range, held as the half-open instant range the queries use.
     *
     * <p>{@code to} is inclusive to the reader — "to the 30th" means the 30th counts —
     * and exclusive to the query, which is why the conversion happens once here
     * rather than in each of the six repository calls.
     */
    private record Window(LocalDate from, LocalDate to) {

        static Window of(LocalDate from, LocalDate to) {
            LocalDate end = to == null ? LocalDate.now() : to;
            LocalDate start = from == null ? end.minusDays(29) : from;
            if (start.isAfter(end)) {
                throw AdvertisingException.invalid("The start of the range falls after its end.");
            }
            return new Window(start, end);
        }

        LocalDateTime start() {
            return from.atStartOfDay();
        }

        LocalDateTime end() {
            return to.plusDays(1).atStartOfDay();
        }
    }
}
