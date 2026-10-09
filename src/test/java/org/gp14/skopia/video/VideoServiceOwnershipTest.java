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
import java.nio.file.*;
import java.util.Set;
import java.util.stream.Collectors;

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

    @Test void missingArtworkDoesNotInventRemoteMedia() {
        var response = service.getVideoById(9L, null);
        org.assertj.core.api.Assertions.assertThat(response.getThumbnailUrl()).isNull();
        org.assertj.core.api.Assertions.assertThat(response.getCreatorAvatar()).isNull();
        video.setThumbnailUrl("/uploads/creator-art.png");
        org.assertj.core.api.Assertions.assertThat(service.getVideoById(9L, null).getThumbnailUrl())
                .isEqualTo("/uploads/creator-art.png");
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

    @Test void thumbnailFailureRemovesAlreadyUploadedVideo() throws Exception {
        org.gp14.skopia.video.dto.CreateVideoRequest request = new org.gp14.skopia.video.dto.CreateVideoRequest();
        request.setTitle("Upload");
        when(creators.findById(41L)).thenReturn(Optional.of(video.getCreator()));
        org.gp14.skopia.model.video.Category category = new org.gp14.skopia.model.video.Category();
        when(categories.findById(1L)).thenReturn(Optional.of(category));
        AccessTier free = new AccessTier(); free.setTierName("FREE");
        when(tiers.findByTierNameIgnoreCase("FREE")).thenReturn(Optional.of(free));
        Path dir = Path.of("uploads"); Files.createDirectories(dir);
        Set<String> before;
        try (var stream = Files.list(dir)) { before = stream.map(p -> p.getFileName().toString()).collect(Collectors.toSet()); }
        var movie = new org.springframework.mock.web.MockMultipartFile("videoFile", "movie.ogg", "video/ogg", "OggSdemo".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        var broken = new org.springframework.mock.web.MockMultipartFile("thumbnailFile", "bad.exe", "application/octet-stream", new byte[]{1});
        assertThatThrownBy(() -> service.createVideo(request, movie, broken, 41L)).isInstanceOf(IllegalArgumentException.class);
        try (var stream = Files.list(dir)) {
            org.assertj.core.api.Assertions.assertThat(stream.map(p -> p.getFileName().toString()).collect(Collectors.toSet())).isEqualTo(before);
        }
    }

    @Test void deletionOnlyCleansOwnedFilesAfterCommit() throws Exception {
        String filename = java.util.UUID.randomUUID() + ".mp4";
        Path owned = Path.of("uploads", filename); Files.createDirectories(owned.getParent()); Files.write(owned, new byte[]{1});
        String shared = java.util.UUID.randomUUID() + ".jpg";
        Path other = Path.of("uploads", shared); Files.write(other, new byte[]{2});
        video.setVideoUrl("/uploads/" + filename); video.setThumbnailUrl("/uploads/" + shared);
        org.mockito.Mockito.lenient().when(videos.existsByThumbnailUrlAndIdNot("/uploads/" + shared, 9L)).thenReturn(true);
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.deleteVideo(9L, 41L);
            org.assertj.core.api.Assertions.assertThat(Files.exists(owned)).isTrue();
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) callback.afterCommit();
            org.assertj.core.api.Assertions.assertThat(Files.exists(owned)).isFalse();
            org.assertj.core.api.Assertions.assertThat(Files.exists(other)).isTrue();
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
            Files.deleteIfExists(owned); Files.deleteIfExists(other);
        }
    }
    @Test void rolledBackUploadRemovesNewFile() throws Exception {
        org.gp14.skopia.video.dto.CreateVideoRequest request = new org.gp14.skopia.video.dto.CreateVideoRequest();
        request.setTitle("Upload");
        when(creators.findById(41L)).thenReturn(Optional.of(video.getCreator()));
        org.gp14.skopia.model.video.Category category = new org.gp14.skopia.model.video.Category();
        when(categories.findById(1L)).thenReturn(Optional.of(category));
        AccessTier free = new AccessTier(); free.setTierName("FREE");
        when(tiers.findByTierNameIgnoreCase("FREE")).thenReturn(Optional.of(free));
        when(videos.saveAndFlush(org.mockito.ArgumentMatchers.any(Video.class))).thenAnswer(invocation -> {
            Video saved = invocation.getArgument(0); saved.setId(19L); return saved;
        });
        var movie = new org.springframework.mock.web.MockMultipartFile("videoFile", "movie.ogg", "video/ogg", "OggSdemo".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        Path uploaded = null;
        try {
            service.createVideo(request, movie, null, 41L);
            var capture = org.mockito.ArgumentCaptor.forClass(Video.class);
            verify(videos).saveAndFlush(capture.capture());
            uploaded = Path.of(capture.getValue().getVideoUrl().substring(1));
            org.assertj.core.api.Assertions.assertThat(Files.exists(uploaded)).isTrue();
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations())
                callback.afterCompletion(org.springframework.transaction.support.TransactionSynchronization.STATUS_ROLLED_BACK);
            org.assertj.core.api.Assertions.assertThat(Files.exists(uploaded)).isFalse();
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
            if (uploaded != null) Files.deleteIfExists(uploaded);
        }
    }

    @Test void failedDeleteTransactionPreservesUploadedFile() throws Exception {
        String filename = java.util.UUID.randomUUID() + ".mp4";
        Path owned = Path.of("uploads", filename); Files.createDirectories(owned.getParent()); Files.write(owned, new byte[]{1});
        video.setVideoUrl("/uploads/" + filename);
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.deleteVideo(9L, 41L);
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations())
                callback.afterCompletion(org.springframework.transaction.support.TransactionSynchronization.STATUS_ROLLED_BACK);
            org.assertj.core.api.Assertions.assertThat(Files.exists(owned)).isTrue();
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
            Files.deleteIfExists(owned);
        }
    }

    @Test void actualUploadReplacementThenDeleteCleansBothFilesAfterTheirCommits() throws Exception {
        var request = new org.gp14.skopia.video.dto.CreateVideoRequest(); request.setTitle("Uploaded");
        when(creators.findById(41L)).thenReturn(Optional.of(video.getCreator()));
        when(categories.findById(1L)).thenReturn(Optional.of(new org.gp14.skopia.model.video.Category()));
        AccessTier free = new AccessTier(); free.setTierName("FREE");
        when(tiers.findByTierNameIgnoreCase("FREE")).thenReturn(Optional.of(free));
        when(videos.saveAndFlush(org.mockito.ArgumentMatchers.any(Video.class))).thenAnswer(invocation -> {
            Video saved = invocation.getArgument(0); saved.setId(9L); return saved;
        });
        var movie = new org.springframework.mock.web.MockMultipartFile("videoFile", "movie.ogg", "video/ogg", "OggSdemo".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        var thumb = new org.springframework.mock.web.MockMultipartFile("thumbnailFile", "thumb.png", "image/png", new byte[]{(byte)137,80,78,71,13,10,26,10,0,0,0,0});
        // The service creates and later updates this same mock-backed entity.
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        Path uploaded = null, thumbnail = null;
        try {
            service.createVideo(request, movie, thumb, 41L);
            var capture = org.mockito.ArgumentCaptor.forClass(Video.class);
            verify(videos).saveAndFlush(capture.capture());
            Video created = capture.getValue();
            uploaded = Path.of(created.getVideoUrl().substring(1)); thumbnail = Path.of(created.getThumbnailUrl().substring(1));
            when(videos.findById(9L)).thenReturn(Optional.of(created));
            when(videos.save(created)).thenReturn(created);
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) callback.afterCommit();
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
            org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
            var replacement = new UpdateVideoRequest(); replacement.setVideoUrl("https://example.test/replaced.ogg");
            service.updateVideo(9L, replacement, 41L);
            org.assertj.core.api.Assertions.assertThat(Files.exists(uploaded)).isTrue();
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) callback.afterCommit();
            org.assertj.core.api.Assertions.assertThat(Files.exists(uploaded)).isFalse();
            org.assertj.core.api.Assertions.assertThat(Files.exists(thumbnail)).isTrue();
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
            org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
            service.deleteVideo(9L, 41L);
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) callback.afterCommit();
            org.assertj.core.api.Assertions.assertThat(Files.exists(thumbnail)).isFalse();
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
            if (uploaded != null) Files.deleteIfExists(uploaded);
            if (thumbnail != null) Files.deleteIfExists(thumbnail);
        }
    }

    @Test void replacementKeepsOldUploadUntilCommitAndDeleteCleansRemainingFile() throws Exception {
        String oldUrl = "/uploads/" + java.util.UUID.randomUUID() + ".mp4";
        String thumbUrl = "/uploads/" + java.util.UUID.randomUUID() + ".jpg";
        Path old = Path.of(oldUrl.substring(1)), thumb = Path.of(thumbUrl.substring(1));
        Files.createDirectories(old.getParent()); Files.write(old, new byte[]{1}); Files.write(thumb, new byte[]{2});
        video.setVideoUrl(oldUrl); video.setThumbnailUrl(thumbUrl);
        when(videos.save(video)).thenReturn(video);
        var request = new UpdateVideoRequest(); request.setVideoUrl("https://example.test/new.mp4");
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.updateVideo(9L, request, 41L);
            org.assertj.core.api.Assertions.assertThat(Files.exists(old)).isTrue();
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) callback.afterCommit();
            org.assertj.core.api.Assertions.assertThat(Files.exists(old)).isFalse();
        } finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); Files.deleteIfExists(old); }
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.deleteVideo(9L, 41L);
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) callback.afterCommit();
            org.assertj.core.api.Assertions.assertThat(Files.exists(thumb)).isFalse();
        } finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); Files.deleteIfExists(thumb); }
    }

    @Test void replacementRollbackAndSharedReferenceKeepOriginal() throws Exception {
        String url = "/uploads/" + java.util.UUID.randomUUID() + ".mp4";
        Path file = Path.of(url.substring(1)); Files.createDirectories(file.getParent()); Files.write(file, new byte[]{1});
        video.setVideoUrl(url);
        var request = new UpdateVideoRequest(); request.setVideoUrl("https://example.test/new.mp4");
        when(videos.save(video)).thenReturn(video);
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.updateVideo(9L, request, 41L);
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations())
                callback.afterCompletion(org.springframework.transaction.support.TransactionSynchronization.STATUS_ROLLED_BACK);
            org.assertj.core.api.Assertions.assertThat(Files.exists(file)).isTrue();
        } finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); }
        video.setVideoUrl(url);
        when(videos.existsByThumbnailUrlAndIdNot(url, 9L)).thenReturn(true);
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.updateVideo(9L, request, 41L);
            for (var callback : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) callback.afterCommit();
            org.assertj.core.api.Assertions.assertThat(Files.exists(file)).isTrue();
        } finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); Files.deleteIfExists(file); }
    }
}
