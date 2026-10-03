package org.gp14.skopia.video;

import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class VideoAccessService {
    private final RegisteredViewerRepository viewers;

    public VideoAccessService(RegisteredViewerRepository viewers) {
        this.viewers = viewers;
    }

    public boolean isOwner(Video video, Long userId) {
        return userId != null && video.getCreator() != null && userId.equals(video.getCreator().getId());
    }

    public boolean isPublished(Video video) {
        return "PUBLISHED".equalsIgnoreCase(video.getVideoStatus()) || "PUBLIC".equalsIgnoreCase(video.getVideoStatus());
    }

    public boolean canSee(Video video, Long userId) {
        return isPublished(video) || isOwner(video, userId);
    }

    public boolean canPlay(Video video, Long userId) {
        if (!canSee(video, userId)) return false;
        if (isOwner(video, userId)) return true;
        if (!isPublished(video)) return false;
        if (video.getAccessTier() == null || !"PREMIUM".equalsIgnoreCase(video.getAccessTier().getTierName())) return true;
        // Entitlement seam: replace this one lookup with the billing subscription check.
        return userId != null && viewers.findById(userId).map(RegisteredViewer::getIsPremium).orElse(false);
    }

    public void requireVisible(Video video, Long userId) {
        if (!canSee(video, userId)) throw new AccessDeniedException("Video is not available");
    }

    public void requirePlayback(Video video, Long userId) {
        if (!canPlay(video, userId)) throw new AccessDeniedException("Playback is not available");
    }
}
