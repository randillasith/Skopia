package org.gp14.skopia.video;

import org.gp14.skopia.video.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", maxAge = 3600)
public class VideoController {

    /**
     * The header the caller is identified by, which is the convention the rest of
     * the platform already uses. It is not proof of identity and is not treated as
     * such; it says which account the UI believes it is acting for.
     */
    private static final String ACTOR_HEADER = "X-User-Id";

    /**
     * Who a request belongs to when the caller does not say.
     *
     * These used to be the only answer, so every viewer shared one watchlist and
     * every upload landed on one channel. They are kept as a fallback so the
     * endpoints still answer for a caller that has not signed in — a signed-in UI
     * sends the header and gets its own rows.
     */
    private static final Long VIEWER_ID = 1L;
    private static final Long CREATOR_ID = 2L;

    private final VideoService videoService;

    public VideoController(VideoService videoService) {
        this.videoService = videoService;
    }

    /** The acting account, or the fallback when the caller is anonymous. */
    private static Long actor(Long header, Long fallback) {
        return (header != null && header > 0) ? header : fallback;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "module", "Video Content, Playback & Viewer Interaction"
        ));
    }

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryResponse>> getCategories() {
        return ResponseEntity.ok(videoService.getCategories());
    }

    @GetMapping("/videos")
    public ResponseEntity<List<VideoResponse>> getVideos(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long category,
            @RequestParam(required = false) String access,
            @RequestParam(required = false) String scope,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        // `scope=mine` is the studio asking for its own shelf, so the caller is the
        // creator being filtered on as well as the viewer the flags are read for.
        List<VideoResponse> videos = videoService.getVideos(
                search, category, access, scope,
                actor(actorId, CREATOR_ID), actor(actorId, VIEWER_ID));
        return ResponseEntity.ok(videos);
    }

    @GetMapping("/videos/{id}")
    public ResponseEntity<VideoResponse> getVideoById(
            @PathVariable Long id,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.getVideoById(id, actor(actorId, VIEWER_ID)));
    }

    @PostMapping(value = "/videos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> createVideoMultipart(
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "categoryId", required = false) Long categoryId,
            @RequestParam(value = "accessType", required = false) String accessType,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "durationSeconds", required = false, defaultValue = "0") Integer durationSeconds,
            @RequestParam(value = "videoUrl", required = false) String videoUrl,
            @RequestParam(value = "thumbnailUrl", required = false) String thumbnailUrl,
            @RequestParam(value = "creatorId", required = false) Long creatorId,
            @RequestParam(value = "videoFile", required = false) MultipartFile videoFile,
            @RequestParam(value = "thumbnailFile", required = false) MultipartFile thumbnailFile,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {

        CreateVideoRequest request = new CreateVideoRequest();
        request.setTitle(title);
        request.setDescription(description);
        request.setCategoryId(categoryId);
        request.setAccessType(accessType);
        request.setStatus(status);
        request.setDurationSeconds(durationSeconds);
        request.setVideoUrl(videoUrl);
        request.setThumbnailUrl(thumbnailUrl);

        Long effectiveCreatorId = (creatorId != null && creatorId > 0) ? creatorId : actor(actorId, CREATOR_ID);
        VideoResponse created = videoService.createVideo(request, videoFile, thumbnailFile, effectiveCreatorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", created.getId(),
                "message", "Video published"
        ));
    }

    @PostMapping(value = "/videos", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> createVideoJson(
            @RequestBody CreateVideoRequest request,
            @RequestParam(value = "creatorId", required = false) Long creatorId,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        Long effectiveCreatorId = (creatorId != null && creatorId > 0) ? creatorId : actor(actorId, CREATOR_ID);
        VideoResponse created = videoService.createVideo(request, null, null, effectiveCreatorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", created.getId(),
                "message", "Video published"
        ));
    }

    @PutMapping("/videos/{id}")
    public ResponseEntity<Map<String, String>> updateVideo(
            @PathVariable Long id,
            @RequestBody UpdateVideoRequest request,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        videoService.updateVideo(id, request, actor(actorId, CREATOR_ID));
        return ResponseEntity.ok(Map.of("message", "Video updated"));
    }

    @DeleteMapping("/videos/{id}")
    public ResponseEntity<Map<String, String>> deleteVideo(
            @PathVariable Long id,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        boolean deleted = videoService.deleteVideo(id, actor(actorId, CREATOR_ID));
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Video deleted"));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Video not found"));
        }
    }

    @PostMapping("/videos/{id}/like")
    public ResponseEntity<Map<String, Object>> toggleLike(
            @PathVariable Long id,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.toggleLike(id, actor(actorId, VIEWER_ID)));
    }

    @PostMapping("/videos/{id}/save")
    public ResponseEntity<Map<String, Object>> toggleSaved(
            @PathVariable Long id,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.toggleSaved(id, actor(actorId, VIEWER_ID)));
    }

    @PostMapping("/videos/{id}/view")
    public ResponseEntity<Map<String, String>> incrementView(@PathVariable Long id) {
        videoService.incrementViewCount(id);
        return ResponseEntity.ok(Map.of("message", "View counted"));
    }

    @PostMapping("/videos/{id}/progress")
    public ResponseEntity<Map<String, String>> saveProgress(
            @PathVariable Long id,
            @RequestBody WatchProgressRequest request,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        videoService.saveProgress(id, actor(actorId, VIEWER_ID), request.getPosition(), request.getCompleted());
        return ResponseEntity.ok(Map.of("message", "Progress saved"));
    }

    @GetMapping("/videos/{id}/comments")
    public ResponseEntity<List<CommentResponse>> getComments(@PathVariable Long id) {
        return ResponseEntity.ok(videoService.getComments(id));
    }

    @PostMapping("/videos/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable Long id,
            @RequestParam(value = "viewerId", required = false) Long viewerId,
            @RequestBody CreateCommentRequest request,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        Long effectiveViewerId = (viewerId != null && viewerId > 0) ? viewerId : actor(actorId, VIEWER_ID);
        CommentResponse response = videoService.addComment(id, effectiveViewerId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Map<String, String>> deleteComment(
            @PathVariable Long id,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        boolean deleted = videoService.deleteComment(id, actor(actorId, VIEWER_ID));
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Comment deleted"));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Comment not found"));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<List<WatchHistoryResponse>> getHistory(
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.getHistory(actor(actorId, VIEWER_ID)));
    }

    @GetMapping("/watchlist")
    public ResponseEntity<List<WatchlistResponse>> getWatchlist(
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.getWatchlist(actor(actorId, VIEWER_ID)));
    }
}
