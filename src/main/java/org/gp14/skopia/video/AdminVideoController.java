package org.gp14.skopia.video;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.gp14.skopia.complaint.ComplaintService;
import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.user.UserManagementService;
import org.gp14.skopia.video.dto.AdminVideoStatusRequest;
import org.gp14.skopia.video.dto.VideoResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/admin/videos")
public class AdminVideoController {
    private final VideoService videos;
    private final UserManagementService users;
    private final ComplaintService complaints;

    public AdminVideoController(VideoService videos, UserManagementService users, ComplaintService complaints) {
        this.videos = videos;
        this.users = users;
        this.complaints = complaints;
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public VideoResponse updateStatus(@PathVariable Long id,
                                      @Valid @RequestBody AdminVideoStatusRequest request,
                                      Authentication authentication,
                                      HttpServletRequest httpRequest) {
        User actor = actor(authentication);
        ContentCreator target = videos.getVideoCreator(id);
        VideoResponse result = videos.moderateVideoStatus(id, request.getStatus(), actor.getId(), request.getReason());
        users.logActivity(actor, target, "VIDEO_STATUS_CHANGED",
                "video " + id + " to " + request.getStatus() +
                        (request.getReason() == null || request.getReason().isBlank() ? "" : "; reason: " + request.getReason().trim()),
                clientIp(httpRequest));
        if ("ARCHIVED".equalsIgnoreCase(request.getStatus())) {
            complaints.notifyReportersOfVideoTakedown(id, result.getTitle());
        }
        return result;
    }

    private User actor(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated administrator required");
        }
        return user;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank()
                ? request.getRemoteAddr()
                : forwarded.split(",", 2)[0].trim();
    }
}
