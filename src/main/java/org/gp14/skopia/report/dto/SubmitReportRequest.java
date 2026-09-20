package org.gp14.skopia.report.dto;

import org.gp14.skopia.report.ReportType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class SubmitReportRequest {

    @NotNull
    private Long viewerId;

    @NotNull
    private ReportType type;

    @NotBlank
    private String details;

    private String contentReference;

    public Long getViewerId() { return viewerId; }
    public void setViewerId(Long viewerId) { this.viewerId = viewerId; }
    public ReportType getType() { return type; }
    public void setType(ReportType type) { this.type = type; }
    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }
    public String getContentReference() { return contentReference; }
    public void setContentReference(String contentReference) { this.contentReference = contentReference; }
}
