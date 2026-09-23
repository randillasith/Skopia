package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.PlacementRequest;
import org.gp14.skopia.advertising.dto.PlacementResponse;
import org.gp14.skopia.advertising.dto.TargetOptionsResponse;
import org.gp14.skopia.model.advertisement.AdPlacement;
import org.gp14.skopia.model.advertisement.Advertisement;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.AdPlacementRepository;
import org.gp14.skopia.repository.AdvertisementRepository;
import org.gp14.skopia.repository.CategoryRepository;
import org.gp14.skopia.repository.VideoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Targeting: which titles and categories an advertisement is attached to.
 *
 * <p>The awkward case this service exists to get right is the one where a viewer
 * would see the same advertisement twice — once because the title was targeted and
 * once because its category was. Duplicates are refused at the point of attaching,
 * and the serving engine de-duplicates by advertisement as well, because targeting
 * added by two different officers can collide without either of them seeing it.
 */
@Service
public class AdPlacementService {

    private final AdPlacementRepository placements;
    private final AdvertisementRepository advertisements;
    private final VideoRepository videos;
    private final CategoryRepository categories;
    private final AdvertisingAccess access;

    public AdPlacementService(AdPlacementRepository placements,
                              AdvertisementRepository advertisements,
                              VideoRepository videos,
                              CategoryRepository categories,
                              AdvertisingAccess access) {
        this.placements = placements;
        this.advertisements = advertisements;
        this.videos = videos;
        this.categories = categories;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<PlacementResponse> forAdvertisement(Long actorId, Long adId) {
        access.require(actorId);
        return placements.findByAdvertisementId(adId).stream().map(this::toResponse).toList();
    }

    /** Attach one advertisement to one target. */
    @Transactional
    public PlacementResponse attach(Long actorId, Long adId, PlacementRequest request) {
        access.require(actorId);
        Advertisement ad = advertisements.findById(adId)
                .orElseThrow(() -> AdvertisingException.notFound("Advertisement", adId));

        boolean hasVideo = request.videoId() != null;
        boolean hasCategory = request.categoryId() != null;
        if (hasVideo == hasCategory) {
            throw AdvertisingException.invalid(hasVideo
                    ? "Target a title or a category, not both — a placement that is two things at "
                      + "once cannot be reported on."
                    : "Choose at least one title or category to target. A placement with no target "
                      + "is never delivered.");
        }

        AdPlacement placement = new AdPlacement();
        placement.setAdvertisement(ad);
        placement.setSlotPosition(request.slotPosition());
        placement.setPriority(request.priority() == null ? 1 : Math.max(1, request.priority()));

        if (hasVideo) {
            if (placements.existsByAdvertisementIdAndVideoIdAndSlotPosition(
                    adId, request.videoId(), request.slotPosition())) {
                throw AdvertisingException.conflict(
                        "This advertisement already fills that slot on that title.");
            }
            Video video = videos.findById(request.videoId())
                    .orElseThrow(() -> AdvertisingException.notFound("Video", request.videoId()));
            placement.setVideo(video);
        } else {
            if (placements.existsByAdvertisementIdAndCategoryIdAndSlotPosition(
                    adId, request.categoryId(), request.slotPosition())) {
                throw AdvertisingException.conflict(
                        "This advertisement already fills that slot in that category.");
            }
            Category category = categories.findById(request.categoryId())
                    .orElseThrow(() -> AdvertisingException.notFound("Category", request.categoryId()));
            placement.setCategory(category);
        }

        // A placement window defaults to the campaign's and may only narrow it.
        // Widening would let a placement outlive the booking that paid for it.
        LocalDateTime campaignFrom = ad.getCampaign().getStartDate();
        LocalDateTime campaignTo = ad.getCampaign().getEndDate();
        LocalDateTime from = request.activeFrom() == null ? campaignFrom
                : max(request.activeFrom(), campaignFrom);
        LocalDateTime to = request.activeTo() == null ? campaignTo
                : min(request.activeTo(), campaignTo);
        if (!to.isAfter(from)) {
            throw AdvertisingException.invalid(
                    "That placement window falls outside the campaign's own dates.");
        }
        placement.setActiveFrom(from);
        placement.setActiveTo(to);

        return toResponse(placements.save(placement));
    }

    @Transactional
    public void detach(Long actorId, Long placementId) {
        access.require(actorId);
        AdPlacement placement = placements.findById(placementId)
                .orElseThrow(() -> AdvertisingException.notFound("Placement", placementId));
        placements.delete(placement);
    }

    /** Everything the targeting picker offers, in one call. */
    @Transactional(readOnly = true)
    public TargetOptionsResponse options(Long actorId, String search) {
        access.require(actorId);
        String needle = search == null ? "" : search.trim().toLowerCase();

        List<TargetOptionsResponse.Option> categoryOptions = categories.findAll().stream()
                .filter(c -> needle.isEmpty() || c.getCategoryName().toLowerCase().contains(needle))
                .map(c -> new TargetOptionsResponse.Option(
                        c.getId(),
                        c.getCategoryName(),
                        c.getCategoryDesc(),
                        (long) videos.findByCategoryId(c.getId()).size()))
                .toList();

        List<TargetOptionsResponse.Option> videoOptions = videos.findAll().stream()
                .filter(v -> needle.isEmpty() || v.getTitle().toLowerCase().contains(needle))
                .limit(200)
                .map(v -> new TargetOptionsResponse.Option(
                        v.getId(),
                        v.getTitle(),
                        v.getCategory() == null ? "Uncategorised" : v.getCategory().getCategoryName(),
                        null))
                .toList();

        return new TargetOptionsResponse(categoryOptions, videoOptions);
    }

    PlacementResponse toResponse(AdPlacement p) {
        Video video = p.getVideo();
        Category category = p.getCategory();
        String kind = video != null ? "video" : "category";
        String label = video != null
                ? video.getTitle()
                : (category == null ? "Untargeted" : category.getCategoryName());

        return new PlacementResponse(
                p.getId(),
                p.getAdvertisement() == null ? null : p.getAdvertisement().getId(),
                video == null ? null : video.getId(),
                video == null ? null : video.getTitle(),
                category == null ? null : category.getId(),
                category == null ? null : category.getCategoryName(),
                p.getSlotPosition(),
                p.getPriority(),
                p.getActiveFrom(),
                p.getActiveTo(),
                kind,
                label);
    }

    private static LocalDateTime max(LocalDateTime a, LocalDateTime b) {
        return a.isAfter(b) ? a : b;
    }

    private static LocalDateTime min(LocalDateTime a, LocalDateTime b) {
        return a.isBefore(b) ? a : b;
    }
}
