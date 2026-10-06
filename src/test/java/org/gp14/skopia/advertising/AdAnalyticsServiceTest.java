package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.*;
import org.gp14.skopia.model.advertisement.AdImpression;
import org.gp14.skopia.model.advertisement.AdPlacement;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.AdImpressionRepository;
import org.gp14.skopia.repository.AdPlacementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Performance figures, checked against a delivery log with known contents.
 *
 * <p>The log is written directly rather than by calling the serving engine, so the
 * expected numbers are stated in the test rather than derived from the code under
 * test — otherwise a counting bug would be reproduced identically on both sides and
 * the assertions would pass.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdAnalyticsServiceTest {

    @Autowired AdAnalyticsService analytics;
    @Autowired AdCampaignService campaigns;
    @Autowired AdvertisementService advertisements;
    @Autowired AdPlacementService placements;
    @Autowired AdPlacementRepository placementRepository;
    @Autowired AdImpressionRepository impressions;
    @Autowired AdvertisingFixture fixture;

    private Long actor;
    private Long campaignId;
    private Long adId;
    private AdPlacement categoryPlacement;
    private AdPlacement videoPlacement;
    private Video longExposure;

    @BeforeEach
    void setUp() {
        actor = fixture.officer().getId();
        Category documentary = fixture.category("Documentary");
        longExposure = fixture.video("The Long Exposure", documentary);

        LocalDateTime now = LocalDateTime.now();
        CampaignResponse campaign = campaigns.create(actor, new CampaignRequest(
                "Autumn Season Launch", "Meridian Films",
                now.minusDays(10), now.plusDays(20), new BigDecimal("2500")));
        campaignId = campaign.id();

        adId = advertisements.create(actor, new AdvertisementRequest(
                campaignId, "Trailer", "/uploads/ads/trailer.mp4", AdType.VIDEO, 20,
                "https://example.invalid/autumn")).id();

        PlacementResponse byCategory = placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.PREROLL, 1, null, null));
        PlacementResponse byVideo = placements.attach(actor, adId, new PlacementRequest(
                longExposure.getId(), null, SlotPosition.MIDROLL, 1, null, null));
        categoryPlacement = placementRepository.findById(byCategory.id()).orElseThrow();
        videoPlacement = placementRepository.findById(byVideo.id()).orElseThrow();
    }

    /* ------------------------------------------------------------- totals */

    @Test
    @DisplayName("impressions, clicks and CTR are counted over the requested window")
    void countsTheWindow() {
        LocalDate today = LocalDate.now();
        // 8 shown, 2 of them clicked → 25.00%
        log(8, 2, today.minusDays(1), "desktop", categoryPlacement);
        // Outside the window, and must not be counted.
        log(100, 50, today.minusDays(40), "desktop", categoryPlacement);

        MetricsResponse metrics = analytics.forCampaign(
                actor, campaignId, today.minusDays(3), today);

        assertThat(metrics.impressions()).isEqualTo(8);
        assertThat(metrics.clicks()).isEqualTo(2);
        assertThat(metrics.ctr()).isEqualTo(25.00);
        assertThat(metrics.subjectName()).isEqualTo("Autumn Season Launch");
    }

    @Test
    @DisplayName("a campaign that has never been shown reports zero, not an error")
    void handlesAnEmptyLog() {
        MetricsResponse metrics = analytics.forCampaign(actor, campaignId, null, null);

        assertThat(metrics.impressions()).isZero();
        assertThat(metrics.clicks()).isZero();
        assertThat(metrics.ctr()).as("zero impressions is 0%, never NaN").isZero();
        assertThat(metrics.daily()).isEmpty();
    }

    /** The range is inclusive at both ends, which is how the dashboard labels it. */
    @Test
    @DisplayName("both ends of the range are included")
    void rangeIsInclusive() {
        LocalDate today = LocalDate.now();
        log(3, 0, today.minusDays(2), "desktop", categoryPlacement);
        log(4, 0, today, "desktop", categoryPlacement);

        assertThat(analytics.forCampaign(actor, campaignId, today.minusDays(2), today).impressions())
                .isEqualTo(7);
        assertThat(analytics.forCampaign(actor, campaignId, today.minusDays(1), today).impressions())
                .isEqualTo(4);
    }

    @Test
    @DisplayName("a backwards range is refused")
    void refusesABackwardsRange() {
        LocalDate today = LocalDate.now();
        assertThatThrownBy(() -> analytics.forCampaign(actor, campaignId, today, today.minusDays(5)))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("falls after its end");
    }

    /* -------------------------------------------------------------- series */

    @Test
    @DisplayName("the daily series has one point per day that had delivery")
    void buildsADailySeries() {
        LocalDate today = LocalDate.now();
        log(5, 1, today.minusDays(2), "desktop", categoryPlacement);
        log(7, 0, today.minusDays(1), "desktop", categoryPlacement);

        MetricsResponse metrics = analytics.forCampaign(
                actor, campaignId, today.minusDays(5), today);

        assertThat(metrics.daily()).hasSize(2);
        assertThat(metrics.daily().get(0).day()).isEqualTo(today.minusDays(2));
        assertThat(metrics.daily().get(0).impressions()).isEqualTo(5);
        assertThat(metrics.daily().get(0).ctr()).isEqualTo(20.00);
        assertThat(metrics.daily().get(1).day()).isEqualTo(today.minusDays(1));
        assertThat(metrics.daily().get(1).clicks()).isZero();
    }

    /* ---------------------------------------------------------- breakdowns */

    @Test
    @DisplayName("breakdowns split the same total by video, category, device, slot and advertisement")
    void breaksDownByDimension() {
        LocalDate today = LocalDate.now();
        log(6, 2, today, "desktop", categoryPlacement);   // category-targeted, PREROLL
        log(4, 1, today, "mobile", videoPlacement);       // title-targeted, MIDROLL

        MetricsResponse metrics = analytics.forCampaign(actor, campaignId, today, today);
        assertThat(metrics.impressions()).isEqualTo(10);

        assertThat(dimension(metrics, "device"))
                .extracting(MetricsResponse.Breakdown.Row::label)
                .containsExactlyInAnyOrder("desktop", "mobile");

        assertThat(dimension(metrics, "slot"))
                .extracting(MetricsResponse.Breakdown.Row::label)
                .containsExactlyInAnyOrder("PREROLL", "MIDROLL");

        // The whole point of recording the video on the impression: a category
        // booking still reports which titles it ran against.
        assertThat(dimension(metrics, "video"))
                .extracting(MetricsResponse.Breakdown.Row::label)
                .containsExactly("The Long Exposure");

        // Every breakdown must add back up to the headline figure, or one of them
        // is dropping rows.
        for (String d : new String[] { "device", "slot", "video", "category", "advertisement" }) {
            assertThat(dimension(metrics, d).stream()
                    .mapToLong(MetricsResponse.Breakdown.Row::impressions).sum())
                    .as("the %s breakdown should account for every impression", d)
                    .isEqualTo(10);
        }
    }

    /* -------------------------------------------------------------- export */

    @Test
    @DisplayName("the CSV carries the same figures as the dashboard, and quotes what it must")
    void exportsCsv() {
        LocalDate today = LocalDate.now();
        log(8, 2, today, "desktop", categoryPlacement);

        String csv = analytics.csvForCampaign(actor, campaignId, today, today);

        assertThat(csv).contains("Campaign,Autumn Season Launch");
        assertThat(csv).contains("Impressions,8");
        assertThat(csv).contains("Clicks,2");
        assertThat(csv).contains("CTR %,25.0");
        assertThat(csv).contains("Date,Impressions,Clicks,CTR %");
        assertThat(csv).contains(today + ",8,2,25.0");
    }

@Test
    @DisplayName("a campaign name that looks like a formula is exported as text")
    void neutralisesSpreadsheetFormulas() {
        // Excel, Numbers and Sheets all evaluate a cell beginning = + - or @ when
        // the file is opened. These names are typed by people, so a name like this
        // is a live formula in the officer's spreadsheet unless it is defused.
        campaigns.update(actor, campaignId, new CampaignRequest(
                "=HYPERLINK(\"http://example.invalid\",\"Results\")", "Meridian Films",
                LocalDateTime.now().minusDays(10), LocalDateTime.now().plusDays(20), BigDecimal.ZERO));

        String csv = analytics.csvForCampaign(actor, campaignId, null, null);

        assertThat(csv)
                .as("the cell must not start with = or a spreadsheet will run it")
                .doesNotContain("Campaign,=HYPERLINK");
        assertThat(csv).contains("Campaign,\"'=HYPERLINK");
    }

    @Test
    @DisplayName("a campaign name containing a comma does not break the CSV")
    void quotesAwkwardNames() {
        campaigns.update(actor, campaignId, new CampaignRequest(
                "Autumn, Winter and Spring", "Meridian Films",
                LocalDateTime.now().minusDays(10), LocalDateTime.now().plusDays(20), BigDecimal.ZERO));

        assertThat(analytics.csvForCampaign(actor, campaignId, null, null))
                .contains("Campaign,\"Autumn, Winter and Spring\"");
    }

    @Test
    @DisplayName("per-advertisement figures are scoped to that advertisement")
    void reportsOnOneAdvertisement() {
        LocalDate today = LocalDate.now();
        log(6, 3, today, "desktop", categoryPlacement);

        MetricsResponse metrics = analytics.forAdvertisement(actor, adId, today, today);
        assertThat(metrics.subject()).isEqualTo("advertisement");
        assertThat(metrics.subjectName()).isEqualTo("Trailer");
        assertThat(metrics.impressions()).isEqualTo(6);
        assertThat(metrics.ctr()).isEqualTo(50.00);
    }

    @Test
    @DisplayName("reading performance is a staff action")
    void refusesANonStaffReader() {
        Long viewer = fixture.viewer().getId();
        assertThatThrownBy(() -> analytics.forCampaign(viewer, campaignId, null, null))
                .isInstanceOf(AdvertisingException.class);
    }

    /* ------------------------------------------------------------ plumbing */

    private java.util.List<MetricsResponse.Breakdown.Row> dimension(MetricsResponse m, String name) {
        return m.breakdowns().stream()
                .filter(b -> b.dimension().equals(name))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no breakdown named " + name))
                .rows();
    }

    /** Write {@code shown} impressions on {@code day}, {@code clicked} of them clicked. */
    private void log(int shown, int clicked, LocalDate day, String device, AdPlacement placement) {
        for (int i = 0; i < shown; i++) {
            AdImpression impression = new AdImpression();
            impression.setPlacement(placement);
            // Every real impression knows the title it ran against, including one
            // delivered through a category placement.
            impression.setVideo(longExposure);
            impression.setShownAt(day.atTime(9, 0).plusMinutes(i));
            impression.setDeviceType(device);
            impression.setWasClicked(i < clicked);
            if (i < clicked) {
                impression.setClickedAt(day.atTime(9, 0).plusMinutes(i).plusSeconds(4));
            }
            impressions.save(impression);
        }
    }
}
