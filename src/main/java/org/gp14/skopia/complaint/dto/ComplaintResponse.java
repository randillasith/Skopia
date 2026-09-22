package org.gp14.skopia.complaint.dto;

import org.gp14.skopia.complaint.Complaint;
import org.gp14.skopia.complaint.ComplaintPriority;
import org.gp14.skopia.complaint.ComplaintStatus;

import java.time.LocalDateTime;

public class ComplaintResponse {
    private Long id;
    private Long reportId;
    private Long reportingViewerId;
    private Long assignedOfficerId;
    private ComplaintStatus status;
    private ComplaintPriority priority;
    private String resolutionNotes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime closedAt;

    public static ComplaintResponse fromEntity(Complaint c) {
        ComplaintResponse dto = new ComplaintResponse();
        dto.id = c.getId();
        dto.reportId = c.getReportId();
        dto.reportingViewerId = c.getReportingViewerId();
        dto.assignedOfficerId = c.getAssignedOfficerId();
        dto.status = c.getStatus();
        dto.priority = c.getPriority();
        dto.resolutionNotes = c.getResolutionNotes();
        dto.createdAt = c.getCreatedAt();
        dto.updatedAt = c.getUpdatedAt();
        dto.closedAt = c.getClosedAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getReportId() { return reportId; }
    public Long getReportingViewerId() { return reportingViewerId; }
    public Long getAssignedOfficerId() { return assignedOfficerId; }
    public ComplaintStatus getStatus() { return status; }
    public ComplaintPriority getPriority() { return priority; }
    public String getResolutionNotes() { return resolutionNotes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public LocalDateTime getClosedAt() { return closedAt; }
}
