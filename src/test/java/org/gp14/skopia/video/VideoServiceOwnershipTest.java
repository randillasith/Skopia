package org.gp14.skopia.video;

import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.video.Video;
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

    VideoService service;
    Video video;

    @BeforeEach
    void setUp() {
        service = new VideoService(videos, categories, tiers, creators, users, viewers,
                likes, comments, history, watchlists, watchlistItems);
        ContentCreator owner = new ContentCreator();
        owner.setId(41L);
        video = new Video();
        video.setId(9L);
        video.setCreator(owner);
        when(videos.findById(9L)).thenReturn(Optional.of(video));
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
}
