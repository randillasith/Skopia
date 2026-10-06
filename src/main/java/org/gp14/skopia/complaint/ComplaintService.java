package org.gp14.skopia.complaint;

import org.gp14.skopia.complaint.dto.ResolveComplaintRequest;
import org.gp14.skopia.complaint.dto.UpdateStatusPriorityRequest;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.report.Report;
import org.gp14.skopia.report.ReportRepository;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.repository.VideoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ComplaintService {

    private final ComplaintRepository complaintRepository;
    private final ComplaintHistoryRepository historyRepository;
    private final org.gp14.skopia.notification.NotificationService notificationService;
    private final UserRepository userRepository;
    private final ReportRepository reportRepository;
    private final VideoRepository videoRepository;

    public ComplaintService(ComplaintRepository complaintRepository,
                             ComplaintHistoryRepository historyRepository,
                             org.gp14.skopia.notification.NotificationService notificationService,
                             UserRepository userRepository,
                             ReportRepository reportRepository,
                             VideoRepository videoRepository) {
        this.complaintRepository = complaintRepository;
        this.historyRepository = historyRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.reportRepository = reportRepository;
        this.videoRepository = videoRepository;
    }

    // Creates a complaint from an existing report (e.g. escalated from UC-FR3-01)
    public Complaint createComplaintFromReport(Long reportId, Long reportingViewerId) {
        List<Complaint> existing = complaintRepository.findByReportId(reportId);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        Complaint complaint = new Complaint(reportId, reportingViewerId);
        Complaint saved = complaintRepository.save(complaint);
        historyRepository.save(new ComplaintHistory(saved.getId(), "CREATED",
                "Complaint created from report " + reportId, null));
        return saved;
    }

    // Step 1: officer views the incoming complaint queue
    public List<Complaint> getOpenComplaints() {
        return complaintRepository.findAllByOrderByCreatedAtDesc();
    }

    // Step 2: officer assigns/accepts a complaint
    public Complaint assignComplaint(Long complaintId, Long officerId) {
        Complaint complaint = getComplaintOrThrow(complaintId);
        complaint.setAssignedOfficerId(officerId);
        complaint.setStatus(ComplaintStatus.ASSIGNED);
        Complaint saved = complaintRepository.save(complaint);
        historyRepository.save(new ComplaintHistory(complaintId, "ASSIGNED",
                "Assigned to officer " + officerId, officerId));
        return saved;
    }

    // Step 3 + Extension 3a: update status/priority, with or without a final resolution
    public Complaint updateStatusAndPriority(Long complaintId, UpdateStatusPriorityRequest request, Long officerId) {
        Complaint complaint = getComplaintOrThrow(complaintId);
        complaint.setStatus(request.getStatus());
        complaint.setPriority(request.getPriority());
        Complaint saved = complaintRepository.save(complaint);
        historyRepository.save(new ComplaintHistory(complaintId, "STATUS_CHANGED",
                "Status -> " + request.getStatus() + ", Priority -> " + request.getPriority(), officerId));
        return saved;
    }

    // Step 4-5: record a resolution and notify the reporting viewer
    public Complaint resolveComplaint(Long complaintId, ResolveComplaintRequest request, Long officerId) {
        Complaint complaint = getComplaintOrThrow(complaintId);
        String notes = (request != null && request.getResolutionNotes() != null && !request.getResolutionNotes().isBlank())
                ? request.getResolutionNotes().trim()
                : "Reviewed and resolved by platform moderation.";
        complaint.setResolutionNotes(notes);
        complaint.setStatus(ComplaintStatus.RESOLVED);
        Complaint saved = complaintRepository.save(complaint);
        historyRepository.save(new ComplaintHistory(complaintId, "RESOLVED", notes, officerId));

        // In-app notification to the reporting viewer
        try {
            Long viewerId = complaint.getReportingViewerId();
            Report rep = null;
            if (complaint.getReportId() != null) {
                rep = reportRepository.findById(complaint.getReportId()).orElse(null);
                if (rep != null) {
                    rep.setStatus(org.gp14.skopia.report.ReportStatus.RESOLVED);
                    reportRepository.save(rep);
                    if (viewerId == null) {
                        viewerId = rep.getViewerId();
                    }
                }
            }

            String videoTitle = null;
            if (rep != null && rep.getContentReference() != null && rep.getContentReference().startsWith("video:")) {
                try {
                    Long vid = Long.parseLong(rep.getContentReference().substring(6));
                    videoTitle = videoRepository.findById(vid).map(Video::getTitle).orElse(null);
                } catch (Exception ignored) {}
            }
            final String finalVideoTitle = videoTitle;

            // Primary reporting viewer notification
            if (viewerId != null) {
                User viewer = userRepository.findById(viewerId).orElse(null);
                if (viewer != null) {
                    notificationService.notifyViewerReportResolved(
                            viewer,
                            complaint.getReportId() != null ? complaint.getReportId() : complaintId,
                            request.getResolutionNotes(),
                            finalVideoTitle
                    );
                }
            }
        } catch (Exception ignored) {}

        return saved;
    }

    // Step 7: close a resolved complaint while retaining its history
    public Complaint closeComplaint(Long complaintId, Long officerId) {
        Complaint complaint = getComplaintOrThrow(complaintId);
        if (complaint.getStatus() != ComplaintStatus.RESOLVED) {
            throw new IllegalStateException("Only resolved complaints can be closed");
        }
        complaint.setStatus(ComplaintStatus.CLOSED);
        complaint.setClosedAt(LocalDateTime.now());
        Complaint saved = complaintRepository.save(complaint);
        historyRepository.save(new ComplaintHistory(complaintId, "CLOSED", "Complaint closed", officerId));
        return saved;
    }

    // Step 6: search complaint history/summary information
    public List<ComplaintHistory> getHistory(Long complaintId) {
        return historyRepository.findByComplaintIdOrderByTimestampAsc(complaintId);
    }

    public List<Complaint> searchByOfficer(Long officerId) {
        return complaintRepository.findByAssignedOfficerId(officerId);
    }

    public List<Complaint> searchByViewer(Long viewerId) {
        return complaintRepository.findByReportingViewerId(viewerId);
    }

    private Complaint getComplaintOrThrow(Long id) {
        return complaintRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found: " + id));
    }
}
