package org.gp14.skopia.video;

import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.ContentCreatorRepository;
import org.gp14.skopia.repository.VideoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class VideoViewConcurrencyIntegrationTest {
    @Autowired VideoService service;
    @Autowired VideoRepository videos;
    @Autowired ContentCreatorRepository creators;
    @Autowired PlatformTransactionManager manager;

    @Test void separatelyTransactedViewersBothIncrementCommittedCount() throws Exception {
        ContentCreator creator = new ContentCreator();
        creator.setUsername("concurrent_" + UUID.randomUUID());
        creator.setEmail(UUID.randomUUID() + "@example.test");
        creator.setPasswordHash("hash"); creator.setChannelName("Concurrency");
        creator = creators.saveAndFlush(creator);
        Long creatorId = creator.getId();
        Video video = new Video(); video.setCreator(creator); video.setTitle("Concurrent views");
        video.setVideoStatus("PUBLISHED"); video.setVideoUrl("https://example.test/video.mp4");
        video.setDuration(10);
        video.setViewCount(0L); video = videos.saveAndFlush(video);
        Long videoId = video.getId();
        CountDownLatch firstIncremented = new CountDownLatch(1);
        CountDownLatch secondStarted = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(() -> new TransactionTemplate(manager).executeWithoutResult(status -> {
                service.incrementViewCount(videoId, creatorId, "first-" + UUID.randomUUID());
                firstIncremented.countDown();
                try {
                    if (!secondStarted.await(5, TimeUnit.SECONDS)) throw new AssertionError("Second transaction did not start");
                    Thread.sleep(150);
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); }
            }));
            var second = pool.submit(() -> {
                try {
                    if (!firstIncremented.await(5, TimeUnit.SECONDS)) throw new AssertionError("First transaction did not increment");
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); }
                new TransactionTemplate(manager).executeWithoutResult(status -> {
                    secondStarted.countDown();
                    service.incrementViewCount(videoId, creatorId, "second-" + UUID.randomUUID());
                });
            });
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        } finally { pool.shutdownNow(); }
        assertThat(videos.findById(videoId).orElseThrow().getViewCount()).isEqualTo(2L);
    }

    @Test void replacementChecksCommittedReferencesBeforeRemovingLocalMedia() throws Exception {
        ContentCreator creator = new ContentCreator(); creator.setUsername("files_" + UUID.randomUUID());
        creator.setEmail(UUID.randomUUID() + "@example.test"); creator.setPasswordHash("hash"); creator.setChannelName("Files");
        creator = creators.saveAndFlush(creator);
        String url = "/uploads/" + UUID.randomUUID() + ".mp4";
        var file = java.nio.file.Path.of(url.substring(1));
        java.nio.file.Files.createDirectories(file.getParent()); java.nio.file.Files.write(file, new byte[]{1});
        try {
            Video owned = new Video(); owned.setCreator(creator); owned.setTitle("Original");
            owned.setDuration(10); owned.setVideoStatus("PUBLISHED"); owned.setViewCount(0L); owned.setVideoUrl(url);
            owned = videos.saveAndFlush(owned);
            Long id = owned.getId(), owner = creator.getId();
            org.gp14.skopia.video.dto.UpdateVideoRequest replace = new org.gp14.skopia.video.dto.UpdateVideoRequest();
            replace.setVideoUrl("https://example.test/replacement.mp4");
            new TransactionTemplate(manager).executeWithoutResult(tx -> service.updateVideo(id, replace, owner));
            assertThat(java.nio.file.Files.exists(file)).isFalse();
            java.nio.file.Files.write(file, new byte[]{1});
            new TransactionTemplate(manager).executeWithoutResult(tx -> {
                Video current = videos.findById(id).orElseThrow(); current.setVideoUrl(url); videos.save(current);
            });
            Video shared = new Video(); shared.setCreator(creator); shared.setTitle("Shared thumbnail");
            shared.setDuration(10); shared.setVideoStatus("PUBLISHED"); shared.setViewCount(0L);
            shared.setVideoUrl("https://example.test/shared.mp4"); shared.setThumbnailUrl(url);
            videos.saveAndFlush(shared);
            new TransactionTemplate(manager).executeWithoutResult(tx -> service.updateVideo(id, replace, owner));
            assertThat(java.nio.file.Files.exists(file)).isTrue();
        } finally { java.nio.file.Files.deleteIfExists(file); }
    }
}
