package org.gp14.skopia.video;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.model.video.*;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class VideoAccessServiceTest {
    private final RegisteredViewerRepository viewers = mock(RegisteredViewerRepository.class);
    private final VideoAccessService access = new VideoAccessService(viewers);

    @Test void premiumRequiresEntitlementOrOwner() {
        Video video = new Video();
        video.setVideoStatus("PUBLISHED");
        AccessTier tier = new AccessTier(); tier.setTierName("PREMIUM"); video.setAccessTier(tier);
        ContentCreator owner = new ContentCreator(); owner.setId(4L); video.setCreator(owner);
        RegisteredViewer paid = new RegisteredViewer(); paid.setIsPremium(true);
        when(viewers.findById(5L)).thenReturn(Optional.of(paid));
        assertThat(access.canPlay(video, null)).isFalse();
        assertThat(access.canPlay(video, 6L)).isFalse();
        assertThat(access.canPlay(video, 5L)).isTrue();
        assertThat(access.canPlay(video, 4L)).isTrue();
        video.setVideoStatus("DRAFT");
        assertThat(access.canSee(video, 5L)).isFalse();
        assertThatThrownBy(() -> access.requirePlayback(video, 5L)).isInstanceOf(AccessDeniedException.class);
        assertThat(access.canPlay(video, 4L)).isTrue();
    }
}
