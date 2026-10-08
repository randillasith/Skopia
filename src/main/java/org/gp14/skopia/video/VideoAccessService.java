package org.gp14.skopia.video;

import org.gp14.skopia.billing.BillingService;
import org.gp14.skopia.model.video.Video;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class VideoAccessService {
    private final VideoPlaybackStrategy free = new FreeVideoPlaybackStrategy();
    private final VideoPlaybackStrategy premium;

    public VideoAccessService(BillingService billing) {
        this.premium = new PremiumVideoPlaybackStrategy(billing);
    }

    public boolean isOwner(Video video, Long userId) {
        return userId != null && video.getCreator() != null && userId.equals(video.getCreator().getId());
    }

    public boolean isPublished(Video video) {
        return "PUBLISHED".equalsIgnoreCase(video.getVideoStatus()) || "PUBLIC".equalsIgnoreCase(video.getVideoStatus());
    }

    public boolean canSee(Video video, Long userId) {
        return (video.getCreator() == null || "ACTIVE".equals(video.getCreator().getAccountStatus()))
                && (isPublished(video) || isOwner(video, userId));
    }

    public boolean canPlay(Video video, Long userId) {
        if (!canSee(video, userId)) return false;
        if (isOwner(video, userId)) return true;
        if (!isPublished(video)) return false;
        String tier = video.getAccessTier() == null ? null : video.getAccessTier().getTierName();
        VideoPlaybackStrategy strategy;
        if (tier == null || "FREE".equalsIgnoreCase(tier)) strategy = free;
        else if ("PREMIUM".equalsIgnoreCase(tier)) strategy = premium;
        else return false;
        return strategy.canPlay(userId);
    }

    public void requireVisible(Video video, Long userId) {
        if (!canSee(video, userId)) throw new AccessDeniedException("Video is not available");
    }

    public void requirePlayback(Video video, Long userId) {
        if (!canPlay(video, userId)) throw new AccessDeniedException("Playback is not available");
    }
}
