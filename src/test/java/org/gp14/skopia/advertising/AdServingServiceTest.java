package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.AdvertisementRequest;
import org.gp14.skopia.advertising.dto.CampaignRequest;
import org.gp14.skopia.advertising.dto.CampaignResponse;
import org.gp14.skopia.advertising.dto.PlacementRequest;
import org.gp14.skopia.advertising.dto.ServedAdResponse;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.AdImpressionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The serving engine, which is where FR5's two hard acceptance criteria live: the
 * right advertisement reaches the right title, and an expired one reaches nobody.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdServingServiceTest {

    @Autowired AdServingService serving;
    @Autowired AdCampaignService campaigns;
    @Autowired AdvertisementService advertisements;
    @Autowired AdPlacementService placements;
    @Autowired AdImpressionRepository impressions;
    @Autowired AdvertisingFixture fixture;

    private Long actor;
    private Category documentary;
    private Category music;
    private Video longExposure;
    private Video cadenceHall;

    @BeforeEach
    void setUp() {
        actor = fixture.officer().getId();
        documentary = fixture.category("Documentary");
        music = fixture.category("Music");
        longExposure = fixture.video("The Long Exposure", documentary);
        cadenceHall = fixture.video("Cadence Hall Live", music);
    }

    /* ---------------------------------------------------------- targeting */

    @Test
    @DisplayName("a category placement reaches every title in that category, and no other")
    void servesByCategory() {
        live("Autumn Season Launch", placement -> placement.category(documentary));

        assertThat(serve(longExposure)).hasSize(1);
        assertThat(serve(cadenceHall))
                .as("a music title is outside the booking")
                .isEmpty();
    }

    @Test
    @DisplayName("a title placement reaches only that title")
    void servesByVideo() {
        live("Single Title Buy", placement -> placement.video(longExposure));

        assertThat(serve(longExposure)).hasSize(1);
        assertThat(serve(cadenceHall)).isEmpty();
    }

    /**
     * The same creative targeted twice — once at the title, once at its category —
     * must still be shown once. Two eligible placements, one advertisement.
     */
    @Test
    @DisplayName("an advertisement targeted both ways is served once, not twice")
    void deduplicatesByAdvertisement() {
        Long adId = live("Doubly Targeted", placement -> placement.category(documentary));
        placements.attach(actor, adId, new PlacementRequest(
                longExposure.getId(), null, SlotPosition.PREROLL, 1, null, null));

        List<ServedAdResponse> served = serving.serve(
                longExposure.getId(), SlotPosition.PREROLL, null, "desktop", 5);

        assertThat(served).hasSize(1);
        assertThat(served.get(0).adId()).isEqualTo(adId);
    }

    @Test
    @DisplayName("a slot only draws from placements booked into that slot")
    void respectsTheSlot() {
        live("Pre-roll only", placement -> placement.category(documentary));

        assertThat(serving.serve(longExposure.getId(), SlotPosition.PREROLL, null, "tv", 1))
                .hasSize(1);
        assertThat(serving.serve(longExposure.getId(), SlotPosition.MIDROLL, null, "tv", 1))
                .isEmpty();
    }

    /* ------------------------------------------------------------- expiry */

    /**
     * FR5: "expired advertisements are identified and removed from active display."
     * Nothing has swept this campaign — the assertion is that delivery does not
     * depend on the sweep having run.
     */
    @Test
    @DisplayName("an expired campaign is never served, sweep or no sweep")
    void neverServesAnExpiredCampaign() {
        Long adId = live("Midsummer Shorts", placement -> placement.category(documentary));
        assertThat(serve(longExposure)).hasSize(1);

        // Wind the campaign's window into the past without touching any status.
        Long campaignId = advertisements.get(actor, adId).campaignId();
        LocalDateTime now = LocalDateTime.now();
        campaigns.update(actor, campaignId, new CampaignRequest("Midsummer Shorts", "Harbour Studio",
                now.minusDays(60), now.minusMinutes(1), BigDecimal.ZERO));

        assertThat(serve(longExposure))
                .as("the stored status still says SCHEDULED; the dates say otherwise")
                .isEmpty();
    }

    @Test
    @DisplayName("a campaign that has not started yet is not served either")
    void doesNotServeEarly() {
        LocalDateTime now = LocalDateTime.now();
        live("Winter Learning Push", placement -> placement.category(documentary),
                now.plusDays(7), now.plusDays(30));

        assertThat(serve(longExposure)).isEmpty();
    }

    @Test
    @DisplayName("a paused campaign stops serving, and a deactivated advertisement too")
    void respectsTheSwitches() {
        Long adId = live("Basement Tapes Live", placement -> placement.category(documentary));
        Long campaignId = advertisements.get(actor, adId).campaignId();

        campaigns.pause(actor, campaignId);
        assertThat(serve(longExposure)).isEmpty();

        campaigns.resume(actor, campaignId);
        assertThat(serve(longExposure)).hasSize(1);

        advertisements.deactivate(actor, adId);
        assertThat(serve(longExposure)).isEmpty();
    }

    /* ------------------------------------------------------------ priority */

    @Test
    @DisplayName("the higher-priority placement wins the slot")
    void higherPriorityWins() {
        live("Low bidder", placement -> placement.category(documentary).priority(1));
        Long premium = live("High bidder", placement -> placement.category(documentary).priority(9));

        // Selection is randomised within a priority band, so run it enough times
        // that a band being ignored would show up.
        for (int i = 0; i < 12; i++) {
            List<ServedAdResponse> served = serve(longExposure);
            assertThat(served).hasSize(1);
            assertThat(served.get(0).adId()).isEqualTo(premium);
        }
    }

    /* ------------------------------------------------------------- logging */

    @Test
    @DisplayName("serving records the impression itself, so nothing depends on the client reporting back")
    void logsOnServe() {
        live("Autumn Season Launch", placement -> placement.category(documentary));
        long before = impressions.count();

        List<ServedAdResponse> served = serving.serve(
                longExposure.getId(), SlotPosition.PREROLL, null, "mobile", 1);

        assertThat(impressions.count()).isEqualTo(before + 1);
        assertThat(served.get(0).impressionId()).isNotNull();

        var logged = impressions.findById(served.get(0).impressionId()).orElseThrow();
        assertThat(logged.getDeviceType()).isEqualTo("mobile");
        assertThat(logged.getWasClicked()).isFalse();
        assertThat(logged.getViewer()).as("a guest is a null viewer, not a refused impression").isNull();
    }

    /**
     * A category placement names no title, so without the impression recording the
     * video, every delivery under a category booking reports as "off a title" and
     * the by-video breakdown answers nothing.
     */
    @Test
    @DisplayName("an impression records the title it actually ran against")
    void logsTheTitleNotJustTheTarget() {
        live("Autumn Season Launch", placement -> placement.category(documentary));

        Long impressionId = serve(longExposure).get(0).impressionId();
        var logged = impressions.findById(impressionId).orElseThrow();

        assertThat(logged.getVideo()).isNotNull();
        assertThat(logged.getVideo().getId()).isEqualTo(longExposure.getId());
        assertThat(logged.getPlacement().getVideo())
                .as("the placement targeted a category, so it names no title at all")
                .isNull();
    }

    @Test
    @DisplayName("a click is recorded once and redirects to the advertiser")
    void recordsAClickOnce() {
        live("Autumn Season Launch", placement -> placement.category(documentary));
        Long impressionId = serve(longExposure).get(0).impressionId();

        // Shown to a guest, so there is no viewer to match against.
        String destination = serving.recordClick(impressionId, null);
        assertThat(destination).isEqualTo("https://example.invalid/autumn");

        var clicked = impressions.findById(impressionId).orElseThrow();
        assertThat(clicked.getWasClicked()).isTrue();
        LocalDateTime firstClick = clicked.getClickedAt();
        assertThat(firstClick).isNotNull();

        // A second click — a double-click, or a retried redirect — must not bill twice.
        assertThat(serving.recordClick(impressionId, null)).isEqualTo(destination);
        assertThat(impressions.findById(impressionId).orElseThrow().getClickedAt())
                .isEqualTo(firstClick);
    }

    @Test
    @DisplayName("the viewer never receives the advertiser's own URL")
    void clickGoesThroughTheTracker() {
        live("Autumn Season Launch", placement -> placement.category(documentary));
        ServedAdResponse served = serve(longExposure).get(0);

        assertThat(served.clickUrl()).isEqualTo("/api/ads/click/" + served.impressionId());
        assertThat(served.clickUrl()).doesNotContain("example.invalid");
        assertThat(served.label()).isEqualTo("Advertisement");
    }

    @Test
    @DisplayName("serving against a title that does not exist is an error, but an empty slot is not")
    void distinguishesMissingFromEmpty() {
        assertThat(serve(longExposure)).as("nothing booked yet").isEmpty();

        assertThatThrownBy(() -> serving.serve(999_999L, SlotPosition.PREROLL, null, null, 1))
                .isInstanceOf(AdvertisingException.class);
        assertThatThrownBy(() -> serving.serve(null, SlotPosition.PREROLL, null, null, 1))
                .isInstanceOf(AdvertisingException.class);
    }

    /* ------------------------------------------------------------ plumbing */


    /* ------------------------------------------------- delivery integrity */

    @Test
    @DisplayName("the same advertisement shown to the same viewer twice in a moment is one impression")
    void collapsesRepeatShowings() {
        live("Autumn Season Launch", placement -> placement.category(documentary));
        Long viewerId = fixture.viewer().getId();

        List<ServedAdResponse> first = serving.serve(
                longExposure.getId(), SlotPosition.PREROLL, viewerId, "desktop", 1);
        List<ServedAdResponse> second = serving.serve(
                longExposure.getId(), SlotPosition.PREROLL, viewerId, "desktop", 1);

        assertThat(first).hasSize(1);
        assertThat(second).hasSize(1);
        assertThat(second.get(0).impressionId())
                .as("a remount, a refresh or a retry is not a second delivery to bill for")
                .isEqualTo(first.get(0).impressionId());
        assertThat(impressions.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("two different viewers seeing it are two impressions")
    void countsSeparateViewersSeparately() {
        live("Autumn Season Launch", placement -> placement.category(documentary));

        serving.serve(longExposure.getId(), SlotPosition.PREROLL,
                fixture.viewer().getId(), "desktop", 1);
        serving.serve(longExposure.getId(), SlotPosition.PREROLL,
                fixture.viewer().getId(), "desktop", 1);

        assertThat(impressions.count())
                .as("collapsing these would lose real delivery")
                .isEqualTo(2);
    }

    @Test
    @DisplayName("a click on somebody else's impression is refused")
    void refusesAClickFromTheWrongViewer() {
        live("Autumn Season Launch", placement -> placement.category(documentary));
        Long shownTo = fixture.viewer().getId();
        Long somebodyElse = fixture.viewer().getId();

        Long impressionId = serving.serve(
                longExposure.getId(), SlotPosition.PREROLL, shownTo, "desktop", 1).get(0).impressionId();

        // The ids are sequential, so without this check walking them is a way to
        // bill an advertiser for clicks nobody made.
        assertThatThrownBy(() -> serving.recordClick(impressionId, somebodyElse))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("shown to somebody else");

        assertThat(impressions.findById(impressionId).orElseThrow().getWasClicked()).isFalse();

        // The viewer it was actually shown to is still fine.
        assertThat(serving.recordClick(impressionId, shownTo)).isNotBlank();
    }

    @Test
    @DisplayName("a click long after the advertisement was shown is refused")
    void refusesAStaleClick() {
        live("Autumn Season Launch", placement -> placement.category(documentary));
        Long impressionId = serve(longExposure).get(0).impressionId();

        // Age the impression rather than waiting six hours for it.
        var impression = impressions.findById(impressionId).orElseThrow();
        impression.setShownAt(LocalDateTime.now().minusDays(2));
        impressions.save(impression);

        assertThatThrownBy(() -> serving.recordClick(impressionId, null))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("too long ago");
    }

    private List<ServedAdResponse> serve(Video video) {
        return serving.serve(video.getId(), SlotPosition.PREROLL, null, "desktop", 1);
    }

    /** A campaign, an advertisement and a placement, confirmed and running now. */
    private Long live(String name, java.util.function.UnaryOperator<Target> target) {
        LocalDateTime now = LocalDateTime.now();
        return live(name, target, now.minusDays(1), now.plusDays(30));
    }

    private Long live(String name, java.util.function.UnaryOperator<Target> target,
                      LocalDateTime start, LocalDateTime end) {
        CampaignResponse campaign = campaigns.create(actor,
                new CampaignRequest(name, "Meridian Films", start, end, BigDecimal.ZERO));
        var ad = advertisements.create(actor, new AdvertisementRequest(
                campaign.id(), name + " creative", "/uploads/ads/" + campaign.id() + ".mp4",
                AdType.VIDEO, 20, "https://example.invalid/autumn"));

        Target t = target.apply(new Target());
        placements.attach(actor, ad.id(), new PlacementRequest(
                t.videoId, t.categoryId, SlotPosition.PREROLL, t.priority, null, null));

        advertisements.activate(actor, ad.id());
        campaigns.confirm(actor, campaign.id());
        return ad.id();
    }

    /** A tiny builder, so each test reads as what it targets rather than as nulls. */
    private static final class Target {
        Long videoId;
        Long categoryId;
        int priority = 1;

        Target video(Video v) { this.videoId = v.getId(); return this; }
        Target category(Category c) { this.categoryId = c.getId(); return this; }
        Target priority(int p) { this.priority = p; return this; }
    }
}
