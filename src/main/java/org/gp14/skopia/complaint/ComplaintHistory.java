package org.gp14.skopia.complaint;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Audit trail entry for a complaint, used to satisfy:
 * - "system displays details/history" (step 2)
 * - "Officer may search complaint history" (step 6)
 * - "the system retains its history" after closing (step 7)
 */
@Entity
@Table(name = "complaint_history")
public class ComplaintHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long complaintId;

    @Column(nullable = false)
    private String action; // e.g. CREATED, ASSIGNED, STATUS_CHANGED, RESOLVED, CLOSED

    @Column(length = 1000)
    private String details;

    // Null when the action was system-generated (e.g. complaint auto-created from a report)
    @Column
    private Long performedByOfficerId;

    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    protected ComplaintHistory() {
        // required by JPA
    }

    public ComplaintHistory(Long complaintId, String action, String details, Long performedByOfficerId) {
        this.complaintId = complaintId;
        this.action = action;
        this.details = details;
        this.performedByOfficerId = performedByOfficerId;
    }

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getComplaintId() { return complaintId; }
    public String getAction() { return action; }
    public String getDetails() { return details; }
    public Long getPerformedByOfficerId() { return performedByOfficerId; }
    public LocalDateTime getTimestamp() { return timestamp; }
}
