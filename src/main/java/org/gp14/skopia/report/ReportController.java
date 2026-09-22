package org.gp14.skopia.report;

import org.gp14.skopia.report.dto.ReportResponse;
import org.gp14.skopia.report.dto.SubmitReportRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.gp14.skopia.model.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    // Steps 1-4: viewer submits a report. @Valid triggers extension 3a (missing fields -> 400)
    @PostMapping
    public ResponseEntity<ReportResponse> submitReport(@Valid @RequestBody SubmitReportRequest request,
                                                       @AuthenticationPrincipal User principal) {
        request.setViewerId(principal.getId());
        Report saved = reportService.submitReport(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ReportResponse.fromEntity(saved));
    }

    // Steps 5-6: viewer tracks their submitted reports (empty list covers extension 5a)
    @GetMapping("/viewer/{viewerId}")
    public ResponseEntity<List<ReportResponse>> getReportsForViewer(@PathVariable Long viewerId,
                                                                    @AuthenticationPrincipal User principal,
                                                                    Authentication authentication) {
        Long effectiveViewerId = isSupportStaff(authentication) ? viewerId : principal.getId();
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
        if (!isSupportStaff(authentication) && !principal.getId().equals(report.getViewerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Report belongs to another account");
        }
        return ResponseEntity.ok(ReportResponse.fromEntity(report));
    }

    private boolean isSupportStaff(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_SUPPORT_OFFICER")
                        || authority.getAuthority().equals("ROLE_ADMINISTRATOR"));
    }
}
