package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.ServedAdResponse;
import org.gp14.skopia.model.advertisement.AdImpression;
import org.gp14.skopia.model.advertisement.AdPlacement;
import org.gp14.skopia.model.advertisement.Advertisement;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.AdImpressionRepository;
import org.gp14.skopia.repository.AdPlacementRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.repository.VideoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * The serving engine: given a video and a slot, which advertisement runs.
 *
 * <p>Eligibility is decided entirely by {@link AdPlacementRepository#findEligible},
 * in the database, against a single {@code now}. Deciding it here instead would mean
 * loading every placement on the platform to filter four fields, and would make the
 * FR5 acceptance criterion — that an expired advertisement is never delivered —
 * depend on application code staying in step with a status column. It does not: the
 * query re-checks the dates, so an advertisement whose campaign ended a minute ago
 * drops out on the next request whether or not the expiry sweep has run.
 *
 * <p>Among equally-eligible placements, selection is random within a priority band.
 * Strict ordering would hand every impression to one advertiser for the whole
 * booking; rotation spreads delivery without needing a cursor stored anywhere,
 * which matters because serving is the one path that has to stay cheap.
 */
@Service
public class AdServingService {

    private final AdPlacementRepository placements;
    private final AdImpressionRepository impressions;
    private final VideoRepository videos;
    private final RegisteredViewerRepository viewers;

    public AdServingService(AdPlacementRepository placements,
                            AdImpressionRepository impressions,
                            VideoRepository videos,
                            RegisteredViewerRepository viewers) {
        this.placements = placements;
        this.impressions = impressions;
        this.videos = videos;
        this.viewers = viewers;
    }

    /**
     * Advertisements to run against one video, in one slot.
     *
     * <p>Each returned advertisement is logged as shown before it is handed over.
     * The alternative — trusting the client to report back — loses every impression
     * where the viewer closes the tab, which is exactly the population that matters
     * when an advertiser asks why delivery looks low.
     *
     * @param limit how many to fill. One is the normal case; a mid-roll break asks
     *              for more.
     */
    @Transactional
    public List<ServedAdResponse> serve(Long videoId, SlotPosition slot, Long viewerId,
                                        String deviceType, int limit) {
        if (videoId == null) {
            throw AdvertisingException.invalid("Say which video the advertisement runs against.");
        }
        SlotPosition wanted = slot == null ? SlotPosition.PREROLL : slot;
        int want = Math.max(1, Math.min(limit, 5));

        Video video = videos.findById(videoId)
                .orElseThrow(() -> AdvertisingException.notFound("Video", videoId));
        Long categoryId = video.getCategory() == null ? null : video.getCategory().getId();

        LocalDateTime now = LocalDateTime.now();
        List<AdPlacement> eligible = placements.findEligible(videoId, categoryId, wanted, now);
        if (eligible.isEmpty()) {
            return List.of();
        }

        List<AdPlacement> chosen = choose(eligible, want);
        List<ServedAdResponse> served = new ArrayList<>(chosen.size());
        for (AdPlacement placement : chosen) {
            AdImpression impression = record(placement, video, viewerId, deviceType, now);
            served.add(present(placement, impression));
        }
        return served;
    }

    /**
     * Pick up to {@code want} placements, one per advertisement.
     *
     * <p>De-duplicating by advertisement is the point: a title targeted directly and
     * through its category produces two eligible placements for the same creative,
     * and showing it twice in one break is the kind of thing a viewer notices and an
     * advertiser is billed for.
     */
    private List<AdPlacement> choose(List<AdPlacement> eligible, int want) {
        // findEligible returns priority-descending, so this keeps the bands in order
        // while letting the members of each band be shuffled independently.
        Map<Integer, List<AdPlacement>> bands = new LinkedHashMap<>();
        for (AdPlacement p : eligible) {
            bands.computeIfAbsent(p.getPriority() == null ? 1 : p.getPriority(),
                    k -> new ArrayList<>()).add(p);
        }

        List<AdPlacement> picked = new ArrayList<>(want);
        List<Long> seenAds = new ArrayList<>(want);
        for (List<AdPlacement> band : bands.values()) {
            List<AdPlacement> shuffled = new ArrayList<>(band);
            Collections.shuffle(shuffled, ThreadLocalRandom.current());
            for (AdPlacement p : shuffled) {
                Long adId = p.getAdvertisement().getId();
                if (seenAds.contains(adId)) continue;
                picked.add(p);
                seenAds.add(adId);
                if (picked.size() == want) return picked;
            }
        }
        return picked;
    }

    /* ------------------------------------------------------------- logging */

    /**
     * Log that a placement was shown.
     *
     * <p>Public because a client that already holds a placement — a lobby standee
     * rendered once and left on screen — reports its own impressions.
     */
    @Transactional
    public AdImpression recordImpression(Long placementId, Long videoId, Long viewerId,
                                         String deviceType) {
        AdPlacement placement = placements.findById(placementId)
                .orElseThrow(() -> AdvertisingException.notFound("Placement", placementId));
        // Falls back to the placement's own title, which is right for a
        // title-targeted placement and null for a category one — the same answer
        // the caller would have given.
        Video shownAgainst = videoId == null
                ? placement.getVideo()
                : videos.findById(videoId).orElse(placement.getVideo());
        return record(placement, shownAgainst, viewerId, deviceType, LocalDateTime.now());
    }

    /**
     * How close together two showings of the same advertisement to the same viewer
     * count as one.
     *
     * <p>A player that remounts, a refresh, or a retried request all ask again
     * within seconds. Each used to be a row the advertiser paid for. Thirty
     * seconds is shorter than any advertisement worth billing for and longer than
     * any of those accidents.
     */
    private static final Duration SAME_SHOWING = Duration.ofSeconds(30);

    /**
     * How long after being shown an advertisement a click still belongs to it.
     *
     * <p>Clicks arrive from a redirect the viewer follows, so they land within
     * seconds or minutes. A click on an impression from last week is not a viewer
     * changing their mind; it is somebody walking the id space.
     */
    private static final Duration CLICK_WINDOW = Duration.ofHours(6);

    private AdImpression record(AdPlacement placement, Video video, Long viewerId,
                                String deviceType, LocalDateTime at) {
        // One showing, one row. Only for an identified viewer: two guests are
        // indistinguishable here, so collapsing them would lose real delivery.
        // Anonymous repeat-calling is the residual gap, noted in the module docs.
        if (viewerId != null) {
            var recent = impressions.findRecent(placement.getId(), viewerId, at.minus(SAME_SHOWING));
            if (recent.isPresent()) {
                return recent.get();
            }
        }
        AdImpression impression = new AdImpression();
        impression.setPlacement(placement);
        impression.setVideo(video);
        impression.setShownAt(at);
        impression.setWasClicked(false);
        impression.setDeviceType(normaliseDevice(deviceType));
        // A guest sees advertisements too, so an unknown viewer is a null column
        // rather than a rejected impression.
        if (viewerId != null) {
            viewers.findById(viewerId).ifPresent(impression::setViewer);
        }
        return impressions.save(impression);
    }

    /**
     * Log a click and return where the viewer should be sent.
     *
     * <p>Idempotent on purpose. A double-click, or a browser retrying the redirect,
     * must not bill the advertiser twice — so the second call returns the same
     * destination and leaves {@code clickedAt} at the first one.
     */
    @Transactional
    public String recordClick(Long impressionId, Long viewerId) {
        AdImpression impression = impressions.findById(impressionId)
                .orElseThrow(() -> AdvertisingException.notFound("Impression", impressionId));

        // A click belongs to the viewer the advertisement was shown to. Without
        // this, any id could be clicked by anybody — and since the ids are
        // sequential, walking them is a way to bill an advertiser for clicks
        // nobody made. An impression shown to a guest has nobody to check, so it
        // is allowed; that is the honest limit of what this can tell.
        Long shownTo = impression.getViewer() == null ? null : impression.getViewer().getId();
        if (shownTo != null && !shownTo.equals(viewerId)) {
            throw AdvertisingException.forbidden(
                    "That advertisement was shown to somebody else.");
        }
        if (impression.getShownAt() != null
                && impression.getShownAt().isBefore(LocalDateTime.now().minus(CLICK_WINDOW))) {
            throw AdvertisingException.invalid(
                    "That advertisement was shown too long ago to be followed now.");
        }

        Advertisement ad = impression.getPlacement().getAdvertisement();
        String destination = ad.getClickUrl();
        if (destination == null || destination.isBlank()) {
            throw AdvertisingException.invalid("That advertisement has no promotional link.");
        }

        if (!Boolean.TRUE.equals(impression.getWasClicked())) {
            impression.setWasClicked(true);
            impression.setClickedAt(LocalDateTime.now());
            impressions.save(impression);
        }
        return destination;
    }

    /* --------------------------------------------------------- presentation */

    private ServedAdResponse present(AdPlacement placement, AdImpression impression) {
        Advertisement ad = placement.getAdvertisement();
        boolean clickable = ad.getClickUrl() != null && !ad.getClickUrl().isBlank();
        return new ServedAdResponse(
                impression.getId(),
                ad.getId(),
                placement.getId(),
                ad.getAdTitle(),
                ad.getCampaign().getAdvertiser(),
                ad.getMediaUrl(),
                ad.getAdType(),
                ad.getAdDuration(),
                placement.getSlotPosition(),
                // The advertiser's own URL is never handed to the player: a click
                // that bypassed the tracker is a click nobody can account for.
                clickable ? "/api/ads/click/" + impression.getId() : null,
                "Advertisement");
    }

    private static String normaliseDevice(String device) {
        if (device == null || device.isBlank()) return "Unknown";
        String trimmed = device.trim();
        return trimmed.length() > 50 ? trimmed.substring(0, 50) : trimmed;
    }
}
