package org.gp14.skopia.report;

import org.gp14.skopia.report.dto.ReportResponse;
import org.gp14.skopia.report.dto.SubmitReportRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<ReportResponse> submitReport(@Valid @RequestBody SubmitReportRequest request) {
        Report saved = reportService.submitReport(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ReportResponse.fromEntity(saved));
    }

    // Steps 5-6: viewer tracks their submitted reports (empty list covers extension 5a)
    @GetMapping("/viewer/{viewerId}")
    public ResponseEntity<List<ReportResponse>> getReportsForViewer(@PathVariable Long viewerId) {
        List<ReportResponse> reports = reportService.getReportsForViewer(viewerId).stream()
                .map(ReportResponse::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReportResponse> getReport(@PathVariable Long id) {
        return ResponseEntity.ok(ReportResponse.fromEntity(reportService.getReportById(id)));
    }
}
