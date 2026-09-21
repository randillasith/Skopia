package org.gp14.skopia.complaint;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * UC-FR3-02: Manage Complaint Resolution.
 * A Complaint is created from a viewer's Report (see UC-FR3-01) once it needs
 * support-staff handling rather than automatic resolution.
 */
@Entity
@Table(name = "complaints")
public class Complaint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long reportId;

    @Column(nullable = false)
    private Long reportingViewerId;

    @Column
    private Long assignedOfficerId; // null until step 2 (assign/accept)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ComplaintStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ComplaintPriority priority;

    @Column(length = 2000)
    private String resolutionNotes;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column
    private LocalDateTime closedAt;

    protected Complaint() {
        // required by JPA
    }

    public Complaint(Long reportId, Long reportingViewerId) {
        this.reportId = reportId;
        this.reportingViewerId = reportingViewerId;
        this.status = ComplaintStatus.OPEN;
        // Default priority until assignment rules are confirmed (Open Issue #1)
        this.priority = ComplaintPriority.MEDIUM;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getReportId() { return reportId; }
    public Long getReportingViewerId() { return reportingViewerId; }
    public Long getAssignedOfficerId() { return assignedOfficerId; }
    public void setAssignedOfficerId(Long assignedOfficerId) { this.assignedOfficerId = assignedOfficerId; }
    public ComplaintStatus getStatus() { return status; }
    public void setStatus(ComplaintStatus status) { this.status = status; }
    public ComplaintPriority getPriority() { return priority; }
    public void setPriority(ComplaintPriority priority) { this.priority = priority; }
    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
}
