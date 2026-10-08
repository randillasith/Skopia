package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.CampaignRequest;
import org.gp14.skopia.advertising.dto.CampaignResponse;
import org.gp14.skopia.advertising.dto.CampaignTotalsRow;
import org.gp14.skopia.advertising.dto.PlacementResponse;
import org.gp14.skopia.model.advertisement.AdCampaign;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.AdCampaignRepository;
import org.gp14.skopia.repository.AdImpressionRepository;
import org.gp14.skopia.repository.AdPlacementRepository;
import org.gp14.skopia.repository.AdvertisementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Campaign management: the booking, its window, and the statuses it moves through.
 *
 * <p>Two rules run through everything here. A campaign's end date must fall after
 * its start date, checked on every write rather than only at creation — the second
 * edit is where an impossible window normally gets in. And a status a person chose
 * is never silently replaced by one the clock implies: {@link AdCampaign#effectiveStatus}
 * derives, and the transitions below are the only things that store.
 */
@Service
public class AdCampaignService {

    private final AdCampaignRepository campaigns;
    private final AdvertisementRepository advertisements;
    private final AdPlacementRepository placements;
    private final AdImpressionRepository impressions;
    private final AdvertisingAccess access;
    private final AdPlacementService placementService;

    public AdCampaignService(AdCampaignRepository campaigns,
                             AdvertisementRepository advertisements,
                             AdPlacementRepository placements,
                             AdImpressionRepository impressions,
                             AdvertisingAccess access,
                             AdPlacementService placementService) {
        this.campaigns = campaigns;
        this.advertisements = advertisements;
        this.placements = placements;
        this.impressions = impressions;
        this.access = access;
        this.placementService = placementService;
    }

    /* ------------------------------------------------------------- reading */

    @Transactional(readOnly = true)
    public List<CampaignResponse> list(Long actorId, String search, CampaignStatus status) {
        access.require(actorId);
        String needle = (search == null || search.isBlank()) ? null : search.trim();
        LocalDateTime now = LocalDateTime.now();

        // The status filter is deliberately NOT pushed into the query. The database
        // can only filter the stored status, and the whole point of the derived one
        // is that the two disagree between expiry sweeps: a campaign that lapsed an
        // hour ago is still SCHEDULED in the table, so asking SQL for EXPIRED would
        // leave it out of the tab it visibly belongs to. Searching is pushed down,
        // since text matching cannot drift.
        List<AdCampaign> rows = campaigns.search(needle, null);

        List<AdCampaign> shown = rows.stream()
                .filter(c -> status == null || c.effectiveStatus(now) == status)
                .toList();
        if (shown.isEmpty()) {
            return List.of();
        }

        // Everything the rows need, fetched for all of them at once. Building each
        // response on its own ran three queries per campaign — the delivery totals,
        // the placements and the advertisements — which is fine for the handful a
        // demo has and is hundreds of round trips for a year of bookings.
        List<Long> ids = shown.stream().map(AdCampaign::getId).toList();

        Map<Long, CampaignTotalsRow> totals = impressions.totalsForCampaigns(ids).stream()
                .collect(Collectors.toMap(CampaignTotalsRow::campaignId, r -> r));

        Map<Long, List<PlacementResponse>> targets = placements.findForCampaigns(ids).stream()
                .collect(Collectors.groupingBy(
                        p -> p.getAdvertisement().getCampaign().getId(),
                        Collectors.mapping(placementService::toResponse, Collectors.toList())));

        Map<Long, Long> adCounts = advertisements.findByCampaignIdIn(ids).stream()
                .collect(Collectors.groupingBy(
                        ad -> ad.getCampaign().getId(), Collectors.counting()));

        return shown.stream()
                .map(c -> toResponse(c, now,
                        totals.get(c.getId()),
                        targets.getOrDefault(c.getId(), List.of()),
                        adCounts.getOrDefault(c.getId(), 0L).intValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public CampaignResponse get(Long actorId, Long id) {
        access.require(actorId);
        return toResponse(load(id));
    }

    /* ------------------------------------------------------------- writing */

    @Transactional
    public CampaignResponse create(Long actorId, CampaignRequest request) {
        User officer = access.actingOfficer(actorId);
        checkWindow(request.startDate(), request.endDate());

        AdCampaign campaign = new AdCampaign();
        campaign.setCreatedBy(officer);
        apply(campaign, request);
        campaign.setCampaignStatus(CampaignStatus.DRAFT);
        return toResponse(campaigns.save(campaign));
    }

    @Transactional
    public CampaignResponse update(Long actorId, Long id, CampaignRequest request) {
        access.require(actorId);
        AdCampaign campaign = loadOwned(actorId, id);
        checkWindow(request.startDate(), request.endDate());

        if (campaign.getCampaignStatus() == CampaignStatus.ARCHIVED) {
            throw AdvertisingException.conflict(
                    "An archived campaign is kept for reporting and cannot be edited.");
        }
        apply(campaign, request);
        return toResponse(campaigns.save(campaign));
    }

    /**
     * Confirm a draft, which is what puts it in front of viewers.
     *
     * <p>A campaign with no advertisement attached would be confirmed and then
     * deliver nothing, which reads as a serving bug rather than an empty booking —
     * so it is refused here, where the reason is still obvious.
     */
    @Transactional
    public CampaignResponse confirm(Long actorId, Long id) {
        access.require(actorId);
        AdCampaign campaign = loadOwned(actorId, id);
        // Confirming is the draft-to-booked step and nothing else. Without this a
        // paused campaign could be restarted by confirming it, which skips the
        // check that resume makes, and an archived one could be brought back.
        if (campaign.getCampaignStatus() != CampaignStatus.DRAFT) {
            throw AdvertisingException.conflict(switch (campaign.getCampaignStatus()) {
                case PAUSED -> "That campaign is paused. Resume it rather than confirming it again.";
                case ARCHIVED -> "An archived campaign cannot be confirmed.";
                default -> "That campaign is already confirmed.";
            });
        }
        if (advertisements.findByCampaignId(id).isEmpty()) {
            throw AdvertisingException.conflict(
                    "Add at least one advertisement before confirming the campaign.");
        }
        // Every advertisement on a campaign about to run needs somewhere to run.
        // Confirming without placements books delivery that cannot happen, and the
        // officer finds out days later from a report showing nothing.
        if (advertisements.findByCampaignId(id).stream()
                .noneMatch(ad -> !placements.findByAdvertisementId(ad.getId()).isEmpty())) {
            throw AdvertisingException.conflict(
                    "Target at least one title or category before confirming — an advertisement "
                            + "with no placement is never delivered.");
        }
        if (!LocalDateTime.now().isBefore(campaign.getEndDate())) {
            throw AdvertisingException.conflict(
                    "This campaign's end date has already passed. Move it before confirming.");
        }
        campaign.setCampaignStatus(CampaignStatus.SCHEDULED);
        return toResponse(campaigns.save(campaign));
    }

    @Transactional
    public CampaignResponse pause(Long actorId, Long id) {
        access.require(actorId);
        AdCampaign campaign = loadOwned(actorId, id);
        CampaignStatus now = campaign.effectiveStatus(LocalDateTime.now());
        if (!now.servable()) {
            throw AdvertisingException.conflict("Only a running or scheduled campaign can be paused.");
        }
        campaign.setCampaignStatus(CampaignStatus.PAUSED);
        return toResponse(campaigns.save(campaign));
    }

    /**
     * Resume a paused campaign.
     *
     * <p>Stored as SCHEDULED rather than ACTIVE and left to the dates to resolve —
     * a campaign paused before it started should not come back already running.
     */
    @Transactional
    public CampaignResponse resume(Long actorId, Long id) {
        access.require(actorId);
        AdCampaign campaign = loadOwned(actorId, id);
        if (campaign.getCampaignStatus() != CampaignStatus.PAUSED) {
            throw AdvertisingException.conflict("That campaign is not paused.");
        }
        if (!LocalDateTime.now().isBefore(campaign.getEndDate())) {
            throw AdvertisingException.conflict(
                    "This campaign ended while it was paused. Extend its end date to run it again.");
        }
        campaign.setCampaignStatus(CampaignStatus.SCHEDULED);
        return toResponse(campaigns.save(campaign));
    }

    /**
     * Take a campaign out of the working list.
     *
     * <p>Deactivation, not deletion. The impressions and clicks it already earned
     * stay where they are, so last month's report does not change because somebody
     * tidied up this month's list.
     */
    @Transactional
    public CampaignResponse archive(Long actorId, Long id) {
        access.require(actorId);
        AdCampaign campaign = loadOwned(actorId, id);
        if (campaign.getCampaignStatus() == CampaignStatus.ARCHIVED) {
            throw AdvertisingException.conflict("That campaign is already archived.");
        }
        campaign.setCampaignStatus(CampaignStatus.ARCHIVED);
        return toResponse(campaigns.save(campaign));
    }

    /**
     * Delete a campaign outright. Allowed only while it is a draft that never ran.
     *
     * <p>Anything that has served has delivery logs pointing at it, and removing it
     * would leave reporting with a hole it cannot explain. Those are archived.
     */
    @Transactional
    public void delete(Long actorId, Long id) {
        access.require(actorId);
        AdCampaign campaign = loadOwned(actorId, id);
        if (campaign.getCampaignStatus() != CampaignStatus.DRAFT) {
            throw AdvertisingException.conflict(
                    "Only a draft can be deleted. Archive this campaign instead — its recorded "
                            + "impressions and clicks are kept so past reporting stays accurate.");
        }
        advertisements.findByCampaignId(id).forEach(ad -> placements.deleteByAdvertisementId(ad.getId()));
        advertisements.deleteAll(advertisements.findByCampaignId(id));
        campaigns.delete(campaign);
    }

    /* ------------------------------------------------------------ internals */

    AdCampaign load(Long id) {
        return campaigns.findById(id).orElseThrow(() -> AdvertisingException.notFound("Campaign", id));
    }

    /**
     * Load a campaign this caller may change.
     *
     * <p>Reading is open to every officer — the console shows one list and that is
     * useful. Changing is not: holding the marketing role says you may run
     * advertising, not that you may edit a colleague's booking. An administrator
     * passes, because clearing up after a departed officer is their job.
     */
    private AdCampaign loadOwned(Long actorId, Long id) {
        AdCampaign campaign = load(id);
        access.requireOwner(actorId, campaign.getCreatedBy() == null ? null
                : campaign.getCreatedBy().getId(), "campaign");
        return campaign;
    }

    private void apply(AdCampaign campaign, CampaignRequest request) {
        campaign.setCampaignName(request.campaignName().trim());
        campaign.setAdvertiser(request.advertiser() == null ? null : request.advertiser().trim());
        campaign.setStartDate(request.startDate());
        campaign.setEndDate(request.endDate());
        campaign.setBudget(request.budget() == null ? BigDecimal.ZERO : request.budget());
    }

    /** UC-FR5-01 extension 6a — an end date on or before the start is rejected. */
    private void checkWindow(LocalDateTime start, LocalDateTime end) {
        if (start != null && end != null && !end.isAfter(start)) {
            throw AdvertisingException.invalid("The end date must fall after the start date.");
        }
    }

    /** One campaign, fetching what it needs. Used where there is only one. */
    CampaignResponse toResponse(AdCampaign c) {
        LocalDateTime now = LocalDateTime.now();
        List<Long> id = List.of(c.getId());
        return toResponse(c, now,
                impressions.totalsForCampaigns(id).stream().findFirst().orElse(null),
                placements.findForCampaigns(id).stream().map(placementService::toResponse).toList(),
                advertisements.findByCampaignId(c.getId()).size());
    }

    /** One campaign, from figures already fetched for the whole page. */
    private CampaignResponse toResponse(AdCampaign c, LocalDateTime now,
                                        CampaignTotalsRow totals,
                                        List<PlacementResponse> placementsForCampaign,
                                        int adCount) {
        long shown = totals == null ? 0 : totals.impressions();
        long clicked = totals == null ? 0 : totals.clickCount();

        Set<String> targets = new LinkedHashSet<>();
        placementsForCampaign.stream()
                .sorted(Comparator.comparing(PlacementResponse::targetLabel))
                .forEach(p -> targets.add(p.targetLabel()));

        User owner = c.getCreatedBy();
        return new CampaignResponse(
                c.getId(),
                c.getCampaignName(),
                c.getAdvertiser(),
                c.effectiveStatus(now),
                c.getCampaignStatus(),
                c.getStartDate(),
                c.getEndDate(),
                c.getBudget(),
                owner == null ? null : owner.getId(),
                owner == null ? null : displayName(owner),
                c.getCreatedAt(),
                c.getUpdatedAt(),
                adCount,
                List.copyOf(targets),
                shown,
                clicked,
                ctr(shown, clicked));
    }

    private static String displayName(User officer) {
        String first = officer.getFirstName() == null ? "" : officer.getFirstName();
        String last = officer.getLastName() == null ? "" : officer.getLastName();
        String full = (first + " " + last).trim();
        return full.isEmpty() ? officer.getUsername() : full;
    }

    /** Clicks over impressions, as a percentage. Zero impressions is 0%, not NaN. */
    static double ctr(long impressions, long clicks) {
        return impressions == 0 ? 0d : Math.round((clicks * 10_000d) / impressions) / 100d;
    }
}
