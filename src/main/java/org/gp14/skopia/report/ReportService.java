package org.gp14.skopia.report;

import org.gp14.skopia.report.dto.SubmitReportRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class ReportService {

    private final ReportRepository reportRepository;

    public ReportService(ReportRepository reportRepository) {
        this.reportRepository = reportRepository;
    }

    // Main Scenario steps 2-4: validate happens via @Valid on the controller DTO
    public Report submitReport(SubmitReportRequest request) {
        Report report = new Report(
                request.getViewerId(),
                request.getType(),
                request.getDetails(),
                request.getContentReference()
        );
        return reportRepository.save(report);
    }

    // Main Scenario steps 5-6. Extension 5a (no reports) is naturally an empty list.
    public List<Report> getReportsForViewer(Long viewerId) {
        return reportRepository.findByViewerIdOrderByCreatedAtDesc(viewerId);
    }

    public Report getReportById(Long id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Report not found: " + id));
    }
}
