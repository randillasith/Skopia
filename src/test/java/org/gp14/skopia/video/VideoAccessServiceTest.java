package org.gp14.skopia.video;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.model.video.*;
import org.gp14.skopia.billing.BillingService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class VideoAccessServiceTest {
    private final BillingService billing = mock(BillingService.class);
    private final VideoAccessService access = new VideoAccessService(billing);

    @Test void unknownTierIsNotTreatedAsFree() {
        Video video = new Video();
        video.setVideoStatus("PUBLISHED");
        AccessTier tier = new AccessTier(); tier.setTierName("UNKNOWN"); video.setAccessTier(tier);
        assertThat(access.canPlay(video, 7L)).isFalse();
    }

    @Test void premiumRequiresEntitlementOrOwner() {
        Video video = new Video();
        video.setVideoStatus("PUBLISHED");
        AccessTier tier = new AccessTier(); tier.setTierName("PREMIUM"); video.setAccessTier(tier);
        ContentCreator owner = new ContentCreator(); owner.setId(4L); video.setCreator(owner);
        // A stale legacy isPremium flag alone must not grant protected playback.
        assertThat(access.canPlay(video, 5L)).isFalse();
        when(billing.hasActivePremium(5L)).thenReturn(true);
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
