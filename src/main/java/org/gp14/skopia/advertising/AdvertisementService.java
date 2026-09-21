package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.AdvertisementRequest;
import org.gp14.skopia.advertising.dto.AdvertisementResponse;
import org.gp14.skopia.advertising.dto.MetricTotalsRow;
import org.gp14.skopia.model.advertisement.AdCampaign;
import org.gp14.skopia.model.advertisement.Advertisement;
import org.gp14.skopia.repository.AdCampaignRepository;
import org.gp14.skopia.repository.AdImpressionRepository;
import org.gp14.skopia.repository.AdPlacementRepository;
import org.gp14.skopia.repository.AdvertisementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The advertisements inside a campaign: their creative, and whether they run.
 *
 * <p>An advertisement cannot be switched on until it has somewhere to appear. That
 * is the only rule of substance here, and it exists because the alternative —
 * an ACTIVE advertisement with no placement — is indistinguishable from a broken
 * serving engine when somebody asks why nothing is showing.
 */
@Service
public class AdvertisementService {

    private final AdvertisementRepository advertisements;
    private final AdCampaignRepository campaigns;
    private final AdPlacementRepository placements;
    private final AdImpressionRepository impressions;
    private final AdvertisingAccess access;
    private final AdPlacementService placementService;

    public AdvertisementService(AdvertisementRepository advertisements,
                                AdCampaignRepository campaigns,
                                AdPlacementRepository placements,
                                AdImpressionRepository impressions,
                                AdvertisingAccess access,
                                AdPlacementService placementService) {
        this.advertisements = advertisements;
        this.campaigns = campaigns;
        this.placements = placements;
        this.impressions = impressions;
        this.access = access;
        this.placementService = placementService;
    }

    @Transactional(readOnly = true)
    public List<AdvertisementResponse> listForCampaign(Long actorId, Long campaignId) {
        access.require(actorId);
        return advertisements.findByCampaignId(campaignId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AdvertisementResponse get(Long actorId, Long id) {
        access.require(actorId);
        return toResponse(load(id));
    }

    @Transactional
    public AdvertisementResponse create(Long actorId, AdvertisementRequest request) {
        access.require(actorId);
        AdCampaign campaign = campaigns.findById(request.campaignId())
                .orElseThrow(() -> AdvertisingException.notFound("Campaign", request.campaignId()));
        if (campaign.getCampaignStatus() == CampaignStatus.ARCHIVED) {
            throw AdvertisingException.conflict("An archived campaign takes no new advertisements.");
        }

        Advertisement ad = new Advertisement();
        ad.setCampaign(campaign);
        apply(ad, request);
        ad.setAdStatus(AdStatus.DRAFT);
        return toResponse(advertisements.save(ad));
    }

    @Transactional
    public AdvertisementResponse update(Long actorId, Long id, AdvertisementRequest request) {
        access.require(actorId);
        Advertisement ad = load(id);
        if (!ad.getCampaign().getId().equals(request.campaignId())) {
            throw AdvertisingException.invalid(
                    "An advertisement cannot be moved between campaigns — its delivery history "
                            + "belongs to the campaign that paid for it.");
        }
        apply(ad, request);
        return toResponse(advertisements.save(ad));
    }

    /** Switch an advertisement on. Whether it actually runs is still the campaign's call. */
    @Transactional
    public AdvertisementResponse activate(Long actorId, Long id) {
        access.require(actorId);
        Advertisement ad = load(id);
        if (placements.findByAdvertisementId(id).isEmpty()) {
            throw AdvertisingException.conflict(
                    "Assign this advertisement to a title or a category before activating it — "
                            + "with no target it would never be delivered.");
        }
        ad.setAdStatus(AdStatus.ACTIVE);
        return toResponse(advertisements.save(ad));
    }

    @Transactional
    public AdvertisementResponse deactivate(Long actorId, Long id) {
        access.require(actorId);
        Advertisement ad = load(id);
        ad.setAdStatus(AdStatus.INACTIVE);
        return toResponse(advertisements.save(ad));
    }

    /**
     * Remove an advertisement and everything targeting it.
     *
     * <p>Its impressions are not touched: they cascade from the placement in the
     * schema, so this is only allowed while the advertisement has never served.
     */
    @Transactional
    public void delete(Long actorId, Long id) {
        access.require(actorId);
        Advertisement ad = load(id);
        MetricTotalsRow totals = impressions.totalsForAd(id, epoch(), far());
        if (totals != null && totals.impressions() > 0) {
            throw AdvertisingException.conflict(
                    "This advertisement has already been shown " + totals.impressions()
                            + " times. Deactivate it instead, so its delivery record survives.");
        }
        placements.deleteByAdvertisementId(id);
        advertisements.delete(ad);
    }

    /* ------------------------------------------------------------ internals */

    Advertisement load(Long id) {
        return advertisements.findById(id)
                .orElseThrow(() -> AdvertisingException.notFound("Advertisement", id));
    }

    private void apply(Advertisement ad, AdvertisementRequest request) {
        ad.setAdTitle(request.adTitle().trim());
        ad.setMediaUrl(request.mediaUrl().trim());
        ad.setAdType(request.adType());
        ad.setAdDuration(request.adDuration() == null ? 0 : request.adDuration());

        String click = request.clickUrl() == null ? null : request.clickUrl().trim();
        if (click != null && !click.isEmpty()) {
            if (!click.startsWith("http://") && !click.startsWith("https://")) {
                throw AdvertisingException.invalid(
                        "Enter a full promotional link, starting with http:// or https://");
            }
            ad.setClickUrl(click);
        } else {
            ad.setClickUrl(null);
        }
    }

    AdvertisementResponse toResponse(Advertisement ad) {
        LocalDateTime now = LocalDateTime.now();
        AdCampaign campaign = ad.getCampaign();
        CampaignStatus campaignStatus = campaign.effectiveStatus(now);
        boolean servable = ad.getAdStatus() == AdStatus.ACTIVE && campaignStatus.servable();

        MetricTotalsRow totals = impressions.totalsForAd(ad.getId(), epoch(), far());
        long shown = totals == null ? 0 : totals.impressions();
        long clicked = totals == null ? 0 : totals.clickCount();

        return new AdvertisementResponse(
                ad.getId(),
                campaign.getId(),
                campaign.getCampaignName(),
                ad.getAdTitle(),
                ad.getMediaUrl(),
                ad.getAdType(),
                ad.getAdDuration(),
                ad.getClickUrl(),
                ad.getAdStatus(),
                servable,
                ad.getCreatedAt(),
                ad.getUpdatedAt(),
                placements.findByAdvertisementId(ad.getId()).stream()
                        .map(placementService::toResponse).toList(),
                shown,
                clicked,
                AdCampaignService.ctr(shown, clicked));
    }

    private static LocalDateTime epoch() {
        return LocalDateTime.of(1970, 1, 1, 0, 0);
    }

    private static LocalDateTime far() {
        return LocalDateTime.now().plusYears(100);
    }
}
