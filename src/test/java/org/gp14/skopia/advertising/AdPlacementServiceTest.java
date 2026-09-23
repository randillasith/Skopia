package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.AdvertisementRequest;
import org.gp14.skopia.advertising.dto.CampaignRequest;
import org.gp14.skopia.advertising.dto.CampaignResponse;
import org.gp14.skopia.advertising.dto.PlacementRequest;
import org.gp14.skopia.advertising.dto.PlacementResponse;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Attaching advertisements to titles and categories, and the shapes that are refused. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdPlacementServiceTest {

    @Autowired AdPlacementService placements;
    @Autowired AdCampaignService campaigns;
    @Autowired AdvertisementService advertisements;
    @Autowired AdvertisingFixture fixture;

    private Long actor;
    private Long adId;
    private Category documentary;
    private Video longExposure;
    private LocalDateTime campaignStart;
    private LocalDateTime campaignEnd;

    @BeforeEach
    void setUp() {
        actor = fixture.officer().getId();
        documentary = fixture.category("Documentary");
        longExposure = fixture.video("The Long Exposure", documentary);

        campaignStart = LocalDateTime.now().minusDays(1);
        campaignEnd = LocalDateTime.now().plusDays(30);
        CampaignResponse campaign = campaigns.create(actor, new CampaignRequest(
                "Autumn Season Launch", "Meridian Films", campaignStart, campaignEnd, BigDecimal.ZERO));
        adId = advertisements.create(actor, new AdvertisementRequest(
                campaign.id(), "Trailer", "/uploads/ads/trailer.mp4", AdType.VIDEO, 20, null)).id();
    }

    @Test
    @DisplayName("a placement targets a title or a category — never both, never neither")
    void requiresExactlyOneTarget() {
        assertThatThrownBy(() -> placements.attach(actor, adId, new PlacementRequest(
                longExposure.getId(), documentary.getId(), SlotPosition.PREROLL, 1, null, null)))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("not both");

        assertThatThrownBy(() -> placements.attach(actor, adId, new PlacementRequest(
                null, null, SlotPosition.PREROLL, 1, null, null)))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("never delivered");
    }

    @Test
    @DisplayName("the same slot on the same target cannot be booked twice")
    void refusesADuplicate() {
        placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.PREROLL, 1, null, null));

        assertThatThrownBy(() -> placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.PREROLL, 1, null, null)))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("already fills that slot");

        // A different slot on the same category is a different booking, and allowed.
        assertThat(placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.MIDROLL, 1, null, null))).isNotNull();
    }

    @Test
    @DisplayName("a placement window defaults to the campaign's, and may only narrow it")
    void windowCannotOutliveTheCampaign() {
        PlacementResponse defaulted = placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.PREROLL, 1, null, null));
        assertThat(defaulted.activeFrom()).isEqualTo(campaignStart);
        assertThat(defaulted.activeTo()).isEqualTo(campaignEnd);

        // Asking for a wider window is clamped, not honoured: a placement must not
        // outlive the booking that paid for it.
        PlacementResponse clamped = placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.MIDROLL, 1,
                campaignStart.minusYears(1), campaignEnd.plusYears(1)));
        assertThat(clamped.activeFrom()).isEqualTo(campaignStart);
        assertThat(clamped.activeTo()).isEqualTo(campaignEnd);

        // A window entirely outside the campaign leaves nothing to run in.
        assertThatThrownBy(() -> placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.POSTROLL, 1,
                campaignEnd.plusDays(1), campaignEnd.plusDays(2))))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("outside the campaign's own dates");
    }

    @Test
    @DisplayName("a target that does not exist is refused rather than silently dropped")
    void refusesAMissingTarget() {
        assertThatThrownBy(() -> placements.attach(actor, adId, new PlacementRequest(
                999_999L, null, SlotPosition.PREROLL, 1, null, null)))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("Video 999999");
    }

    @Test
    @DisplayName("detaching removes only that placement")
    void detaches() {
        PlacementResponse first = placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.PREROLL, 1, null, null));
        placements.attach(actor, adId, new PlacementRequest(
                longExposure.getId(), null, SlotPosition.PREROLL, 1, null, null));
        assertThat(placements.forAdvertisement(actor, adId)).hasSize(2);

        placements.detach(actor, first.id());
        assertThat(placements.forAdvertisement(actor, adId)).hasSize(1);
    }

    @Test
    @DisplayName("the picker offers categories with their title counts, and searches both lists")
    void offersTargetOptions() {
        var all = placements.options(actor, null);
        assertThat(all.categories()).extracting(o -> o.label()).contains("Documentary");
        assertThat(all.categories()).filteredOn(o -> o.label().equals("Documentary"))
                .first().extracting(o -> o.count()).isEqualTo(1L);
        assertThat(all.videos()).extracting(o -> o.label()).contains("The Long Exposure");

        var searched = placements.options(actor, "long exp");
        assertThat(searched.videos()).hasSize(1);
        assertThat(searched.categories()).isEmpty();
    }

    @Test
    @DisplayName("an advertisement with no target cannot be activated")
    void refusesToActivateAnUntargetedAdvertisement() {
        assertThatThrownBy(() -> advertisements.activate(actor, adId))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("before activating it");

        placements.attach(actor, adId, new PlacementRequest(
                null, documentary.getId(), SlotPosition.PREROLL, 1, null, null));
        assertThat(advertisements.activate(actor, adId).status()).isEqualTo(AdStatus.ACTIVE);
    }
}
