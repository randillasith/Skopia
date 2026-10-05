package org.gp14.skopia.report;

import org.gp14.skopia.complaint.ComplaintService;
import org.gp14.skopia.report.dto.SubmitReportRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final ComplaintService complaintService;

    public ReportService(ReportRepository reportRepository, ComplaintService complaintService) {
        this.reportRepository = reportRepository;
        this.complaintService = complaintService;
    }

    // Main Scenario steps 2-4: validate happens via @Valid on the controller DTO
    @Transactional
    public Report submitReport(SubmitReportRequest request) {
        Report report = new Report(
                request.getViewerId(),
                request.getType(),
                request.getDetails(),
                request.getContentReference()
        );
        Report saved = reportRepository.save(report);
        complaintService.createComplaintFromReport(saved.getId(), saved.getViewerId());
        return saved;
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
