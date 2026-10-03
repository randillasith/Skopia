package org.gp14.skopia.video;

import org.gp14.skopia.model.user.User;
import org.gp14.skopia.video.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class VideoController {

    private static final String ACTOR_HEADER = "X-User-Id";

    private final VideoService videoService;

    public VideoController(VideoService videoService) {
        this.videoService = videoService;
    }

    /** Ignore legacy caller-supplied IDs; only the bearer principal identifies an actor. */
    private static Long actor(User principal, Long header, Long fallback) {
        return principal == null ? null : principal.getId();
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
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        if ("mine".equalsIgnoreCase(scope) && principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required for creator videos");
        }
        // `scope=mine` is the studio asking for its own shelf, so the caller is the
        // creator being filtered on as well as the viewer the flags are read for.
        List<VideoResponse> videos = videoService.getVideos(
                search, category, access, scope,
                actor(principal, actorId, null), actor(principal, actorId, null));
        return ResponseEntity.ok(videos);
    }

    @GetMapping("/videos/{id}")
    public ResponseEntity<VideoResponse> getVideoById(
            @PathVariable Long id,
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.getVideoById(id, actor(principal, actorId, null)));
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
            @AuthenticationPrincipal User principal,
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

        Long effectiveCreatorId = actor(principal, actorId, null);
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
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        Long effectiveCreatorId = actor(principal, actorId, null);
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
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        videoService.updateVideo(id, request, actor(principal, actorId, null));
        return ResponseEntity.ok(Map.of("message", "Video updated"));
    }

    @DeleteMapping("/videos/{id}")
    public ResponseEntity<Map<String, String>> deleteVideo(
            @PathVariable Long id,
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        boolean deleted = videoService.deleteVideo(id, actor(principal, actorId, null));
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Video deleted"));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Video not found"));
        }
    }

    @PostMapping("/videos/{id}/like")
    public ResponseEntity<Map<String, Object>> toggleLike(
            @PathVariable Long id,
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.toggleLike(id, actor(principal, actorId, null)));
    }

    @PostMapping("/videos/{id}/save")
    public ResponseEntity<Map<String, Object>> toggleSaved(
            @PathVariable Long id,
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.toggleSaved(id, actor(principal, actorId, null)));
    }

    @PostMapping("/videos/{id}/view")
    public ResponseEntity<Map<String, String>> incrementView(@PathVariable Long id,
            @AuthenticationPrincipal User principal) {
        videoService.incrementViewCount(id, actor(principal, null, null));
        return ResponseEntity.ok(Map.of("message", "View counted"));
    }

    @PostMapping("/videos/{id}/progress")
    public ResponseEntity<Map<String, String>> saveProgress(
            @PathVariable Long id,
            @RequestBody WatchProgressRequest request,
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        videoService.saveProgress(id, actor(principal, actorId, null), request.getPosition(), request.getCompleted());
        return ResponseEntity.ok(Map.of("message", "Progress saved"));
    }

    @GetMapping("/videos/{id}/comments")
    public ResponseEntity<List<CommentResponse>> getComments(@PathVariable Long id,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(videoService.getComments(id, actor(principal, null, null)));
    }

    @PostMapping("/videos/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable Long id,
            @RequestParam(value = "viewerId", required = false) Long viewerId,
            @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        Long effectiveViewerId = actor(principal, actorId, null);
        CommentResponse response = videoService.addComment(id, effectiveViewerId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/comments/{id}")
    public ResponseEntity<CommentResponse> editComment(@PathVariable Long id,
            @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(videoService.editComment(id, actor(principal, null, null), request));
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Map<String, String>> deleteComment(
            @PathVariable Long id,
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        boolean deleted = videoService.deleteComment(id, actor(principal, actorId, null));
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Comment deleted"));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Comment not found"));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<List<WatchHistoryResponse>> getHistory(
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.getHistory(actor(principal, actorId, null)));
    }

    @GetMapping("/watchlist")
    public ResponseEntity<List<WatchlistResponse>> getWatchlist(
            @AuthenticationPrincipal User principal,
            @RequestHeader(value = ACTOR_HEADER, required = false) Long actorId) {
        return ResponseEntity.ok(videoService.getWatchlist(actor(principal, actorId, null)));
    }
}
