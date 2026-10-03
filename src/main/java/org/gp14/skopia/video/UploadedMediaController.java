package org.gp14.skopia.video;

import org.gp14.skopia.model.user.User;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.VideoRepository;
import org.gp14.skopia.security.TokenService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

@RestController
public class UploadedMediaController {
    private final VideoRepository videos;
    private final VideoAccessService access;
    private final TokenService tokens;

    public UploadedMediaController(VideoRepository videos, VideoAccessService access, TokenService tokens) {
        this.videos = videos;
        this.access = access;
        this.tokens = tokens;
    }

    @GetMapping("/uploads/{filename:.+}")
    public ResponseEntity<ResourceRegion> get(@PathVariable String filename,
            @RequestParam(value = "access", required = false) String signed,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String range,
            @AuthenticationPrincipal User principal) throws IOException {
        if (!filename.matches("[a-f0-9-]{36}\\.(mp4|webm|ogg|mov|jpg|jpeg|png|webp)"))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        String url = "/uploads/" + filename;
        Optional<Video> movie = videos.findFirstByVideoUrl(url);
        boolean thumbnail = movie.isEmpty();
        Video video = movie.or(() -> videos.findFirstByThumbnailUrl(url))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Long userId = principal == null ? null : principal.getId();
        boolean permitted = thumbnail ? access.canSee(video, userId) : access.canPlay(video, userId);
        if (!permitted && signed != null) {
            // A signed URL is bound to a user and rechecked against current entitlement.
            // The user id is extracted only after signature verification in TokenService.
            Long signedUser = tokens.verifyMediaUser(signed, video.getId(), filename);
            permitted = signedUser != null && (thumbnail ? access.canSee(video, signedUser) : access.canPlay(video, signedUser));
        }
        if (!permitted) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        Path path = Path.of("uploads").toAbsolutePath().normalize().resolve(filename);
        if (!Files.isRegularFile(path)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        Resource resource = new FileSystemResource(path);
        long length = resource.contentLength();
        if (length == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        HttpRange requested;
        try {
            var ranges = range == null ? java.util.List.<HttpRange>of() : HttpRange.parseRanges(range);
            if (ranges.size() > 1) throw new IllegalArgumentException("Multiple ranges not supported");
            requested = ranges.isEmpty() ? null : ranges.get(0);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
        }
        long start = requested == null ? 0 : requested.getRangeStart(length);
        long end = requested == null ? length - 1 : requested.getRangeEnd(length);
        if (start >= length || end < start) throw new ResponseStatusException(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
        String extension = filename.substring(filename.lastIndexOf('.') + 1);
        MediaType type = switch (extension) {
            case "mp4" -> MediaType.valueOf("video/mp4");
            case "webm" -> MediaType.valueOf("video/webm");
            case "ogg" -> MediaType.valueOf("video/ogg");
            case "mov" -> MediaType.valueOf("video/quicktime");
            case "png" -> MediaType.IMAGE_PNG;
            case "webp" -> MediaType.valueOf("image/webp");
            default -> MediaType.IMAGE_JPEG;
        };
        return ResponseEntity.status(requested == null ? HttpStatus.OK : HttpStatus.PARTIAL_CONTENT)
                .contentType(type).header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(new ResourceRegion(resource, start, end - start + 1));
    }
}
