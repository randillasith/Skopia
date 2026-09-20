package org.gp14.skopia.report.dto;

import org.gp14.skopia.report.Report;
import org.gp14.skopia.report.ReportStatus;
import org.gp14.skopia.report.ReportType;

import java.time.LocalDateTime;

public class ReportResponse {
    private Long id;
    private Long viewerId;
    private ReportType type;
    private String details;
    private String contentReference;
    private ReportStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ReportResponse fromEntity(Report r) {
        ReportResponse dto = new ReportResponse();
        dto.id = r.getId();
        dto.viewerId = r.getViewerId();
        dto.type = r.getType();
        dto.details = r.getDetails();
        dto.contentReference = r.getContentReference();
        dto.status = r.getStatus();
        dto.createdAt = r.getCreatedAt();
        dto.updatedAt = r.getUpdatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getViewerId() { return viewerId; }
    public ReportType getType() { return type; }
    public String getDetails() { return details; }
    public String getContentReference() { return contentReference; }
    public ReportStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
