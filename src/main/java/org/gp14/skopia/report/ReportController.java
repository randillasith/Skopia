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
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.repository.VideoRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.server.ResponseStatusException;

import org.gp14.skopia.complaint.Complaint;
import org.gp14.skopia.complaint.ComplaintRepository;
import org.gp14.skopia.complaint.ComplaintStatus;
import org.gp14.skopia.complaint.dto.ResolveComplaintRequest;
import java.util.List;
import org.gp14.skopia.complaint.ComplaintService;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;
    private final ReportRepository reportRepository;
    private final ComplaintService complaintService;
    private final ComplaintRepository complaintRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final VideoRepository videoRepository;

    public ReportController(ReportService reportService,
                            ReportRepository reportRepository,
                            ComplaintService complaintService,
                            ComplaintRepository complaintRepository,
                            NotificationService notificationService,
                            UserRepository userRepository,
                            VideoRepository videoRepository) {
        this.reportService = reportService;
        this.reportRepository = reportRepository;
        this.complaintService = complaintService;
        this.complaintRepository = complaintRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.videoRepository = videoRepository;
    }

    // Steps 1-4: viewer submits a report. @Valid triggers extension 3a (missing fields -> 400)
    @PostMapping
    public ResponseEntity<ReportResponse> submitReport(@Valid @RequestBody SubmitReportRequest request,
                                                       @AuthenticationPrincipal User principal) {
        if (principal != null) {
            request.setViewerId(principal.getId());
        }
        Report saved = reportService.submitReport(request);
        try {
            Long viewerId = principal != null ? principal.getId() : saved.getViewerId();
            complaintService.createComplaintFromReport(saved.getId(), viewerId);
        } catch (Exception ignored) {}

        // Send notification to the reporting viewer that their report is received and under review
        try {
            User targetUser = principal;
            if (targetUser == null && saved.getViewerId() != null) {
                targetUser = userRepository.findById(saved.getViewerId()).orElse(null);
            }
            if (targetUser != null) {
                String videoTitle = null;
                if (saved.getContentReference() != null && saved.getContentReference().startsWith("video:")) {
                    try {
                        Long videoId = Long.parseLong(saved.getContentReference().substring(6));
                        videoTitle = videoRepository.findById(videoId).map(Video::getTitle).orElse(null);
                    } catch (Exception ignored) {}
                }
                notificationService.notifyViewerReportSubmitted(targetUser, saved.getId(), videoTitle);
            }
        } catch (Exception ignored) {}

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
                : (principal != null ? principal.getId() : viewerId);
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
                                                        @AuthenticationPrincipal User principal) {
        Report report = reportService.getReportById(id);
        report.setStatus(ReportStatus.RESOLVED);
        Report saved = reportRepository.save(report);

        // Also resolve associated complaint if any
        try {
            List<Complaint> complaints = complaintRepository.findByReportId(id);
            for (Complaint c : complaints) {
                c.setStatus(ComplaintStatus.RESOLVED);
                if (request != null && request.getResolutionNotes() != null) {
                    c.setResolutionNotes(request.getResolutionNotes());
                }
                complaintRepository.save(c);
            }
        } catch (Exception ignored) {}

        // Notify reporting viewer
        try {
            if (saved.getViewerId() != null) {
                User viewer = userRepository.findById(saved.getViewerId()).orElse(null);
                if (viewer != null) {
                    String videoTitle = null;
                    if (saved.getContentReference() != null && saved.getContentReference().startsWith("video:")) {
                        try {
                            Long vid = Long.parseLong(saved.getContentReference().substring(6));
                            videoTitle = videoRepository.findById(vid).map(Video::getTitle).orElse(null);
                        } catch (Exception ignored) {}
                    }
                    String notes = (request != null && request.getResolutionNotes() != null) ? request.getResolutionNotes() : "Reviewed and resolved by platform moderation.";
                    notificationService.notifyViewerReportResolved(viewer, saved.getId(), notes, videoTitle);
                }
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(ReportResponse.fromEntity(saved));
    }

    private boolean isSupportStaff(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_SUPPORT_OFFICER")
                        || authority.getAuthority().equals("ROLE_ADMINISTRATOR")
                        || authority.getAuthority().equals("ROLE_USER"));
    }
}
