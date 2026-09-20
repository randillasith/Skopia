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

    private static final Long VIEWER_ID = 1L;
    private static final Long CREATOR_ID = 2L;

    private final VideoService videoService;

    public VideoController(VideoService videoService) {
        this.videoService = videoService;
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
            @RequestParam(required = false) String scope) {
        List<VideoResponse> videos = videoService.getVideos(search, category, access, scope, CREATOR_ID, VIEWER_ID);
        return ResponseEntity.ok(videos);
    }

    @GetMapping("/videos/{id}")
    public ResponseEntity<VideoResponse> getVideoById(@PathVariable Long id) {
        return ResponseEntity.ok(videoService.getVideoById(id, VIEWER_ID));
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
            @RequestParam(value = "thumbnailFile", required = false) MultipartFile thumbnailFile) {

        CreateVideoRequest request = new CreateVideoRequest();
        request.setTitle(title);
        request.setDescription(description);
        request.setCategoryId(categoryId);
        request.setAccessType(accessType);
        request.setStatus(status);
        request.setDurationSeconds(durationSeconds);
        request.setVideoUrl(videoUrl);
        request.setThumbnailUrl(thumbnailUrl);

        Long effectiveCreatorId = (creatorId != null && creatorId > 0) ? creatorId : CREATOR_ID;
        VideoResponse created = videoService.createVideo(request, videoFile, thumbnailFile, effectiveCreatorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", created.getId(),
                "message", "Video published"
        ));
    }

    @PostMapping(value = "/videos", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> createVideoJson(
            @RequestBody CreateVideoRequest request,
            @RequestParam(value = "creatorId", required = false) Long creatorId) {
        Long effectiveCreatorId = (creatorId != null && creatorId > 0) ? creatorId : CREATOR_ID;
        VideoResponse created = videoService.createVideo(request, null, null, effectiveCreatorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", created.getId(),
                "message", "Video published"
        ));
    }

    @PutMapping("/videos/{id}")
    public ResponseEntity<Map<String, String>> updateVideo(@PathVariable Long id, @RequestBody UpdateVideoRequest request) {
        videoService.updateVideo(id, request, CREATOR_ID);
        return ResponseEntity.ok(Map.of("message", "Video updated"));
    }

    @DeleteMapping("/videos/{id}")
    public ResponseEntity<Map<String, String>> deleteVideo(@PathVariable Long id) {
        boolean deleted = videoService.deleteVideo(id, CREATOR_ID);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Video deleted"));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Video not found"));
        }
    }

    @PostMapping("/videos/{id}/like")
    public ResponseEntity<Map<String, Object>> toggleLike(@PathVariable Long id) {
        return ResponseEntity.ok(videoService.toggleLike(id, VIEWER_ID));
    }

    @PostMapping("/videos/{id}/save")
    public ResponseEntity<Map<String, Object>> toggleSaved(@PathVariable Long id) {
        return ResponseEntity.ok(videoService.toggleSaved(id, VIEWER_ID));
    }

    @PostMapping("/videos/{id}/view")
    public ResponseEntity<Map<String, String>> incrementView(@PathVariable Long id) {
        videoService.incrementViewCount(id);
        return ResponseEntity.ok(Map.of("message", "View counted"));
    }

    @PostMapping("/videos/{id}/progress")
    public ResponseEntity<Map<String, String>> saveProgress(@PathVariable Long id, @RequestBody WatchProgressRequest request) {
        videoService.saveProgress(id, VIEWER_ID, request.getPosition(), request.getCompleted());
        return ResponseEntity.ok(Map.of("message", "Progress saved"));
    }

    @GetMapping("/videos/{id}/comments")
    public ResponseEntity<List<CommentResponse>> getComments(@PathVariable Long id) {
        return ResponseEntity.ok(videoService.getComments(id));
    }

    @PostMapping("/videos/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(@PathVariable Long id, @RequestBody CreateCommentRequest request) {
        CommentResponse response = videoService.addComment(id, VIEWER_ID, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Map<String, String>> deleteComment(@PathVariable Long id) {
        boolean deleted = videoService.deleteComment(id, VIEWER_ID);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Comment deleted"));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Comment not found"));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<List<WatchHistoryResponse>> getHistory() {
        return ResponseEntity.ok(videoService.getHistory(VIEWER_ID));
    }

    @GetMapping("/watchlist")
    public ResponseEntity<List<WatchlistResponse>> getWatchlist() {
        return ResponseEntity.ok(videoService.getWatchlist(VIEWER_ID));
    }
}
