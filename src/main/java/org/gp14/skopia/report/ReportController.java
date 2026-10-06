package org.gp14.skopia.report;

import org.gp14.skopia.report.dto.ReportResponse;
import org.gp14.skopia.report.dto.SubmitReportRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.notification.NotificationService;
import org.gp14.skopia.repository.VideoRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.server.ResponseStatusException;

import org.gp14.skopia.complaint.dto.ResolveComplaintRequest;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;
    private final NotificationService notificationService;
    private final VideoRepository videoRepository;

    public ReportController(ReportService reportService,
                            NotificationService notificationService,
                            VideoRepository videoRepository) {
        this.reportService = reportService;
        this.notificationService = notificationService;
        this.videoRepository = videoRepository;
    }

    // Steps 1-4: viewer submits a report. @Valid triggers extension 3a (missing fields -> 400)
    @PostMapping
    public ResponseEntity<ReportResponse> submitReport(@Valid @RequestBody SubmitReportRequest request,
                                                       @AuthenticationPrincipal User principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        request.setViewerId(principal.getId());
        Report saved = reportService.submitReport(request);

        // Send notification to the reporting viewer that their report is received and under review
        String videoTitle = null;
        if (saved.getContentReference() != null && saved.getContentReference().startsWith("video:")) {
            try {
                Long videoId = Long.parseLong(saved.getContentReference().substring(6));
                videoTitle = videoRepository.findById(videoId).map(Video::getTitle).orElse(null);
            } catch (NumberFormatException ignored) {
                // A non-video reference remains a valid general report.
            }
        }
        notificationService.notifyViewerReportSubmitted(principal, saved.getId(), videoTitle);

        return ResponseEntity.status(HttpStatus.CREATED).body(ReportResponse.fromEntity(saved));
    }

    // Admin & Support staff: list all reports
    @GetMapping
    public ResponseEntity<List<ReportResponse>> getAllReports(Authentication authentication) {
        if (!isSupportStaff(authentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff only");
        }
        List<ReportResponse> reports = reportService.getAllReports().stream()
                .map(ReportResponse::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(reports);
    }

    // Steps 5-6: viewer tracks their submitted reports (empty list covers extension 5a)
    @GetMapping("/viewer/{viewerId}")
    public ResponseEntity<List<ReportResponse>> getReportsForViewer(@PathVariable Long viewerId,
                                                                    @AuthenticationPrincipal User principal,
                                                                    Authentication authentication) {
        Long effectiveViewerId = isSupportStaff(authentication)
                ? viewerId
                : requirePrincipal(principal).getId();
        List<ReportResponse> reports = reportService.getReportsForViewer(effectiveViewerId).stream()
                .map(ReportResponse::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReportResponse> getReport(@PathVariable Long id,
                                                    @AuthenticationPrincipal User principal,
                                                    Authentication authentication) {
        Report report = reportService.getReportById(id);
        if (!isSupportStaff(authentication) && (principal == null || !principal.getId().equals(report.getViewerId()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Report belongs to another account");
        }
        return ResponseEntity.ok(ReportResponse.fromEntity(report));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<ReportResponse> resolveReport(@PathVariable Long id,
                                                        @RequestBody(required = false) ResolveComplaintRequest request,
                                                        @AuthenticationPrincipal User principal,
                                                        Authentication authentication) {
        if (!isSupportStaff(authentication)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff only");
        Report saved = reportService.resolveReport(id, request, requirePrincipal(principal).getId());
        return ResponseEntity.ok(ReportResponse.fromEntity(saved));
    }

    private boolean isSupportStaff(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_SUPPORT_OFFICER")
                        || authority.getAuthority().equals("ROLE_ADMINISTRATOR"));
    }

    private User requirePrincipal(User principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        return principal;
    }
}
