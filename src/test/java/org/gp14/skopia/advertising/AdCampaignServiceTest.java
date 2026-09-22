package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.AdvertisementRequest;
import org.gp14.skopia.advertising.dto.CampaignRequest;
import org.gp14.skopia.advertising.dto.CampaignResponse;
import org.gp14.skopia.advertising.dto.PlacementRequest;
import org.gp14.skopia.model.user.MarketingOfficer;
import org.gp14.skopia.model.video.Category;
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

/**
 * Campaign management: the window rule, the status transitions, and who may do any
 * of it.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdCampaignServiceTest {

    @Autowired AdCampaignService campaigns;
    @Autowired AdvertisementService advertisements;
    @Autowired AdPlacementService placements;
    @Autowired AdvertisingFixture fixture;

    private MarketingOfficer officer;
    private Long actor;

    @BeforeEach
    void setUp() {
        officer = fixture.officer();
        actor = officer.getId();
    }

    private CampaignRequest request(LocalDateTime start, LocalDateTime end) {
        return new CampaignRequest("Autumn Season Launch", "Meridian Films",
                start, end, new BigDecimal("2500.00"));
    }

    /* ----------------------------------------------------------- the window */

    @Test
    @DisplayName("a campaign is created as a draft, with its window intact")
    void createsADraft() {
        LocalDateTime start = LocalDateTime.now().plusDays(1);
        CampaignResponse created = campaigns.create(actor, request(start, start.plusDays(30)));

        assertThat(created.storedStatus()).isEqualTo(CampaignStatus.DRAFT);
        assertThat(created.status()).isEqualTo(CampaignStatus.DRAFT);
        assertThat(created.campaignName()).isEqualTo("Autumn Season Launch");
        assertThat(created.createdById()).isEqualTo(actor);
    }

    /** UC-FR5-01 extension 6a. */
    @Test
    @DisplayName("an end date on or before the start is refused, on create and on edit")
    void refusesABackwardsWindow() {
        LocalDateTime start = LocalDateTime.now().plusDays(10);

        assertThatThrownBy(() -> campaigns.create(actor, request(start, start.minusDays(1))))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("end date must fall after the start date");

        // The same date twice is a zero-length campaign, which is equally useless.
        assertThatThrownBy(() -> campaigns.create(actor, request(start, start)))
                .isInstanceOf(AdvertisingException.class);

        // The edit path is checked separately: a valid campaign made impossible by
        // a later edit is the case that actually reaches production.
        CampaignResponse ok = campaigns.create(actor, request(start, start.plusDays(5)));
        assertThatThrownBy(() -> campaigns.update(actor, ok.id(), request(start, start.minusDays(2))))
                .isInstanceOf(AdvertisingException.class);
    }

    /* ------------------------------------------------------- derived status */

    @Test
    @DisplayName("status follows the clock once a campaign is confirmed")
    void derivesStatusFromTheDates() {
        LocalDateTime now = LocalDateTime.now();
        CampaignResponse future = confirmed(now.plusDays(2), now.plusDays(9));
        CampaignResponse running = confirmed(now.minusDays(1), now.plusDays(9));

        assertThat(future.status()).isEqualTo(CampaignStatus.SCHEDULED);
        assertThat(running.status()).isEqualTo(CampaignStatus.ACTIVE);
    }

    /**
     * The FR5 acceptance criterion, at the management layer: a campaign whose end
     * date has passed reads as expired even though nothing has swept it yet.
     */
    @Test
    @DisplayName("a lapsed campaign reads as expired before any sweep runs")
    void lapsedCampaignReadsAsExpired() {
        LocalDateTime now = LocalDateTime.now();
        CampaignResponse ended = confirmed(now.minusDays(30), now.minusMinutes(1));

        assertThat(ended.status()).isEqualTo(CampaignStatus.EXPIRED);
        assertThat(ended.storedStatus())
                .as("the stored value is still the pre-sweep one, which is the point")
                .isEqualTo(CampaignStatus.SCHEDULED);
    }

    @Test
    @DisplayName("a paused campaign stays paused, whatever its dates say")
    void pausingBeatsTheClock() {
        LocalDateTime now = LocalDateTime.now();
        CampaignResponse running = confirmed(now.minusDays(1), now.plusDays(9));

        CampaignResponse paused = campaigns.pause(actor, running.id());
        assertThat(paused.status()).isEqualTo(CampaignStatus.PAUSED);

        // Resuming hands the decision back to the dates rather than assuming ACTIVE.
        CampaignResponse resumed = campaigns.resume(actor, running.id());
        assertThat(resumed.status()).isEqualTo(CampaignStatus.ACTIVE);
    }

    @Test
    @DisplayName("a campaign that ended while paused cannot simply be resumed")
    void cannotResumeIntoThePast() {
        LocalDateTime now = LocalDateTime.now();
        CampaignResponse running = confirmed(now.minusDays(2), now.plusSeconds(2));
        campaigns.pause(actor, running.id());

        // Move the end date behind us, the way time would have.
        campaigns.update(actor, running.id(), new CampaignRequest("Autumn Season Launch",
                "Meridian Films", now.minusDays(2), now.minusMinutes(1), BigDecimal.ZERO));

        assertThatThrownBy(() -> campaigns.resume(actor, running.id()))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("ended while it was paused");
    }

    /* ------------------------------------------------------------ confirming */

    @Test
    @DisplayName("an empty campaign cannot be confirmed")
    void refusesToConfirmWithNoAdvertisements() {
        LocalDateTime now = LocalDateTime.now();
        CampaignResponse empty = campaigns.create(actor, request(now.plusDays(1), now.plusDays(8)));

        assertThatThrownBy(() -> campaigns.confirm(actor, empty.id()))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("at least one advertisement");
    }

    /* ------------------------------------------------------------- deleting */

    @Test
    @DisplayName("a confirmed campaign is archived, never deleted")
    void archivesRatherThanDeletes() {
        LocalDateTime now = LocalDateTime.now();
        CampaignResponse live = confirmed(now.minusDays(1), now.plusDays(9));

        assertThatThrownBy(() -> campaigns.delete(actor, live.id()))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("Archive this campaign instead");

        assertThat(campaigns.archive(actor, live.id()).status()).isEqualTo(CampaignStatus.ARCHIVED);
    }

    /* ----------------------------------------------------------------- RBAC */

    @Test
    @DisplayName("an account with no staff grant is refused, and an unidentified caller too")
    void refusesEveryoneElse() {
        Long ordinary = fixture.viewer().getId();
        LocalDateTime now = LocalDateTime.now();

        assertThatThrownBy(() -> campaigns.list(ordinary, null, null))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("granted by an administrator");

        assertThatThrownBy(() -> campaigns.list(null, null, null))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("Sign in");

        // An administrator may read, but a booking belongs to a marketing officer:
        // ad_campaigns.created_by points at marketing_officers, and an admin has no
        // row there.
        Long admin = fixture.administrator().getId();
        assertThat(campaigns.list(admin, null, null)).isNotNull();
        assertThatThrownBy(() -> campaigns.create(admin, request(now.plusDays(1), now.plusDays(3))))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("Only a marketing officer can own a campaign");
    }

    /* ------------------------------------------------------------ searching */

    @Test
    @DisplayName("the list filters by derived status, not by the stored one")
    void listFiltersOnWhatTheScreenShows() {
        LocalDateTime now = LocalDateTime.now();
        confirmed(now.minusDays(30), now.minusMinutes(1));   // lapsed, not yet swept
        confirmed(now.minusDays(1), now.plusDays(9));        // running

        assertThat(campaigns.list(actor, null, CampaignStatus.EXPIRED))
                .as("still SCHEDULED in the database, but expired to anyone reading the screen")
                .hasSize(1);
        assertThat(campaigns.list(actor, null, CampaignStatus.ACTIVE)).hasSize(1);
        assertThat(campaigns.list(actor, "meridian", null)).hasSize(2);
        assertThat(campaigns.list(actor, "nothing-like-this", null)).isEmpty();
    }

    /**
     * A campaign with one advertisement pointed at one category, then confirmed.
     *
     * <p>A campaign whose end date is already behind us is built the only way one
     * can legitimately exist: confirmed inside a valid window, then left to lapse.
     * {@code confirm} refuses a window that has already closed, which is itself
     * covered above — so reaching past it here would be testing a state the
     * application cannot produce.
     */
    private CampaignResponse confirmed(LocalDateTime start, LocalDateTime end) {
        boolean alreadyLapsed = !end.isAfter(LocalDateTime.now());
        LocalDateTime confirmableEnd = alreadyLapsed ? LocalDateTime.now().plusDays(1) : end;

        CampaignResponse campaign = campaigns.create(actor, request(start, confirmableEnd));
        Category category = fixture.category("Documentary-" + campaign.id());
        var ad = advertisements.create(actor, new AdvertisementRequest(
                campaign.id(), "Trailer", "/uploads/ads/trailer.mp4", AdType.VIDEO, 20,
                "https://example.invalid/autumn"));
        placements.attach(actor, ad.id(), new PlacementRequest(
                null, category.getId(), SlotPosition.PREROLL, 1, null, null));
        CampaignResponse live = campaigns.confirm(actor, campaign.id());

        if (!alreadyLapsed) {
            return live;
        }
        // Wind the end date back, leaving the stored status at SCHEDULED — exactly
        // the row the clock would have left behind between two expiry sweeps.
        return campaigns.update(actor, campaign.id(),
                request(start, end));
    }
}
