package org.gp14.skopia.complaint;

import org.gp14.skopia.complaint.dto.ResolveComplaintRequest;
import org.gp14.skopia.complaint.dto.UpdateStatusPriorityRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Service
public class ComplaintService {

    private final ComplaintRepository complaintRepository;
    private final ComplaintHistoryRepository historyRepository;
    private final NotificationService notificationService;

    public ComplaintService(ComplaintRepository complaintRepository,
                             ComplaintHistoryRepository historyRepository,
                             NotificationService notificationService) {
        this.complaintRepository = complaintRepository;
        this.historyRepository = historyRepository;
        this.notificationService = notificationService;
    }

    // Creates a complaint from an existing report (e.g. escalated from UC-FR3-01)
    public Complaint createComplaintFromReport(Long reportId, Long reportingViewerId) {
        Complaint complaint = new Complaint(reportId, reportingViewerId);
        Complaint saved = complaintRepository.save(complaint);
        historyRepository.save(new ComplaintHistory(saved.getId(), "CREATED",
                "Complaint created from report " + reportId, null));
        return saved;
    }

    // Step 1: officer views the incoming (unassigned) complaint queue
    public List<Complaint> getOpenComplaints() {
        return complaintRepository.findByStatus(ComplaintStatus.OPEN);
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
        complaint.setResolutionNotes(request.getResolutionNotes());
        complaint.setStatus(ComplaintStatus.RESOLVED);
        Complaint saved = complaintRepository.save(complaint);
        historyRepository.save(new ComplaintHistory(complaintId, "RESOLVED",
                request.getResolutionNotes(), officerId));
        notificationService.notifyViewerOfStatusChange(
                complaint.getReportingViewerId(), complaintId, ComplaintStatus.RESOLVED);
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
                .orElseThrow(() -> new NoSuchElementException("Complaint not found: " + id));
    }
}
