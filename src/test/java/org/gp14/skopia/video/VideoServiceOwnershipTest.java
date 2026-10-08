package org.gp14.skopia.video;

import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.model.video.AccessTier;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.video.dto.UpdateVideoRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VideoServiceOwnershipTest {
    @Mock VideoRepository videos;
    @Mock CategoryRepository categories;
    @Mock AccessTierRepository tiers;
    @Mock ContentCreatorRepository creators;
    @Mock UserRepository users;
    @Mock RegisteredViewerRepository viewers;
    @Mock VideoLikeRepository likes;
    @Mock CommentRepository comments;
    @Mock WatchHistoryRepository history;
    @Mock WatchlistRepository watchlists;
    @Mock WatchlistItemRepository watchlistItems;
    @Mock VideoAccessService access;
    @Mock org.gp14.skopia.security.TokenService tokens;
    @Mock org.gp14.skopia.billing.BillingService billing;
    @Mock org.gp14.skopia.notification.NotificationService notifications;
    @Mock org.gp14.skopia.complaint.ComplaintService complaints;

    VideoService service;
    Video video;

    @BeforeEach
    void setUp() {
        service = new VideoService(videos, categories, tiers, creators, users, viewers,
                likes, comments, history, watchlists, watchlistItems, access, tokens, billing, notifications, complaints);
        ContentCreator owner = new ContentCreator();
        owner.setId(41L);
        video = new Video();
        video.setId(9L);
        video.setCreator(owner);
        org.mockito.Mockito.lenient().when(videos.findById(9L)).thenReturn(Optional.of(video));
    }

    @Test
    void creatorCannotUpdateAnotherCreatorsVideo() {
        UpdateVideoRequest request = new UpdateVideoRequest();
        request.setStatus("ARCHIVED");

        assertThatThrownBy(() -> service.updateVideo(9L, request, 42L))
                .isInstanceOf(AccessDeniedException.class);
        verify(videos, never()).save(video);
    }

    @Test
    void creatorCannotDeleteAnotherCreatorsVideo() {
        assertThatThrownBy(() -> service.deleteVideo(9L, 42L))
                .isInstanceOf(AccessDeniedException.class);
        verify(videos, never()).delete(video);
    }

    @Test
    void creatorNeedsActivePassToSelectPremiumAndSelectionPersists() {
        UpdateVideoRequest request = new UpdateVideoRequest();
        request.setAccessType("PREMIUM");
        AccessTier premium = new AccessTier(); premium.setTierName("PREMIUM");
        when(billing.hasActivePremium(41L)).thenReturn(false);
        assertThatThrownBy(() -> service.updateVideo(9L, request, 41L)).isInstanceOf(AccessDeniedException.class);
        verify(videos, never()).save(video);

        when(billing.hasActivePremium(41L)).thenReturn(true);
        when(tiers.findByTierNameIgnoreCase("PREMIUM")).thenReturn(Optional.of(premium));
        when(videos.save(video)).thenReturn(video);
        org.assertj.core.api.Assertions.assertThat(service.updateVideo(9L, request, 41L).getAccessType()).isEqualTo("PREMIUM");
        org.assertj.core.api.Assertions.assertThat(video.getAccessTier()).isSameAs(premium);
    }

    @Test
    void creatorCanToggleVisibilityButCannotOverrideModeration() {
        UpdateVideoRequest privateRequest = new UpdateVideoRequest();
        privateRequest.setStatus("PRIVATE");
        video.setVideoStatus("PUBLISHED");
        when(videos.save(video)).thenReturn(video);
        service.updateVideo(9L, privateRequest, 41L);
        org.assertj.core.api.Assertions.assertThat(video.getVideoStatus()).isEqualTo("DRAFT");

        UpdateVideoRequest publicRequest = new UpdateVideoRequest();
        publicRequest.setStatus("PUBLIC");
        service.updateVideo(9L, publicRequest, 41L);
        org.assertj.core.api.Assertions.assertThat(video.getVideoStatus()).isEqualTo("PUBLISHED");

        video.setVideoStatus("PULLED");
        assertThatThrownBy(() -> service.updateVideo(9L, publicRequest, 41L))
                .isInstanceOf(AccessDeniedException.class);
        org.assertj.core.api.Assertions.assertThat(video.getVideoStatus()).isEqualTo("PULLED");
    }

    @Test
    void invalidCreatorStatusIsRejected() {
        UpdateVideoRequest request = new UpdateVideoRequest();
        request.setStatus("PULLED");
        video.setVideoStatus("DRAFT");
        assertThatThrownBy(() -> service.updateVideo(9L, request, 41L))
                .isInstanceOf(IllegalArgumentException.class);
        verify(videos, never()).save(video);
    }

    @Test
    void privateVideoCannotBeViewedBySomeoneElse() {
        VideoAccessService actual = new VideoAccessService(billing);
        video.setVideoStatus("DRAFT");
        org.assertj.core.api.Assertions.assertThat(actual.canSee(video, 42L)).isFalse();
        org.assertj.core.api.Assertions.assertThat(actual.canSee(video, 41L)).isTrue();
    }

    @Test
    void onlyCommentOwnerCanEditOrDeleteAndDeletedCannotBeEdited() {
        org.gp14.skopia.model.user.RegisteredViewer author = new org.gp14.skopia.model.user.RegisteredViewer();
        author.setId(7L); author.setDisplayName("Author");
        org.gp14.skopia.model.interaction.Comment comment = new org.gp14.skopia.model.interaction.Comment();
        comment.setId(12L); comment.setViewer(author); comment.setVideo(video);
        comment.setCommentStatus("VISIBLE"); comment.setCommentText("before");
        when(comments.findById(12L)).thenReturn(Optional.of(comment));
        org.gp14.skopia.video.dto.CreateCommentRequest request = new org.gp14.skopia.video.dto.CreateCommentRequest();
        request.setText(" after ");
        assertThatThrownBy(() -> service.editComment(12L, 8L, request)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.deleteComment(12L, null)).isInstanceOf(AccessDeniedException.class);
        org.assertj.core.api.Assertions.assertThat(service.editComment(12L, 7L, request).getText()).isEqualTo("after");
        org.assertj.core.api.Assertions.assertThat(service.deleteComment(12L, 7L)).isTrue();
        assertThatThrownBy(() -> service.editComment(12L, 7L, request)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void rejectsReplyToAnotherVideo() {
        org.gp14.skopia.model.user.RegisteredViewer author = new org.gp14.skopia.model.user.RegisteredViewer();
        author.setId(7L);
        when(viewers.findById(7L)).thenReturn(Optional.of(author));
        org.gp14.skopia.model.interaction.Comment parent = new org.gp14.skopia.model.interaction.Comment();
        Video other = new Video(); other.setId(10L); parent.setVideo(other); parent.setCommentStatus("VISIBLE");
        when(comments.findById(12L)).thenReturn(Optional.of(parent));
        org.gp14.skopia.video.dto.CreateCommentRequest request = new org.gp14.skopia.video.dto.CreateCommentRequest();
        request.setText("reply"); request.setParentId(12L);
        assertThatThrownBy(() -> service.addComment(9L, 7L, request)).isInstanceOf(IllegalArgumentException.class);
        verify(comments, never()).save(org.mockito.ArgumentMatchers.any());
    }
}
