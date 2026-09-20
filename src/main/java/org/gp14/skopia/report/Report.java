package org.gp14.skopia.report;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * UC-FR3-01: Submit and Track Video or Technical Report.
 */
@Entity
@Table(name = "reports")
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long viewerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportType type;

    @Column(nullable = false, length = 2000)
    private String details;

    // Optional reference to the video/page the report is about
    @Column
    private String contentReference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    protected Report() {
        // required by JPA
    }

    public Report(Long viewerId, ReportType type, String details, String contentReference) {
        this.viewerId = viewerId;
        this.type = type;
        this.details = details;
        this.contentReference = contentReference;
        this.status = ReportStatus.SUBMITTED; // Main Scenario step 4: initial status
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
    public Long getViewerId() { return viewerId; }
    public ReportType getType() { return type; }
    public String getDetails() { return details; }
    public String getContentReference() { return contentReference; }
    public ReportStatus getStatus() { return status; }
    public void setStatus(ReportStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
