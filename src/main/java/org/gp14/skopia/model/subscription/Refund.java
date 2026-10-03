package org.gp14.skopia.model.subscription;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.Administrator;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "refunds")
@Getter @Setter @NoArgsConstructor
public class Refund {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "refund_id") private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false) private Payment payment;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processed_by") private Administrator processedBy;
    @Column(name = "refund_amount", nullable = false, precision = 10, scale = 2) private BigDecimal refundAmount;
    @Column(nullable = false, length = 500) private String reason;
    @Column(name = "refund_status", nullable = false, length = 20) private String refundStatus = "PENDING";
    @Column(name = "requested_date", nullable = false, updatable = false) private LocalDateTime requestedDate;
    @Column(name = "processed_date") private LocalDateTime processedDate;
    @Column(name = "decision_note", length = 500) private String decisionNote;
    @PrePersist protected void onCreate() { if (requestedDate == null) requestedDate = LocalDateTime.now(); }
}
