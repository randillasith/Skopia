package org.gp14.skopia.model.subscription;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "refunds", uniqueConstraints = {
        @UniqueConstraint(name = "uq_refunds_payment", columnNames = "payment_id")
}, indexes = {
        @Index(name = "idx_refunds_status_requested", columnList = "refund_status,requested_date"),
        @Index(name = "idx_refunds_category", columnList = "category")
})
@Getter
@Setter
@NoArgsConstructor
public class Refund {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "refund_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processed_by")
    private User processedBy;

    @Column(name = "refund_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal refundAmount;

    @Column(nullable = false, length = 500)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 40)
    private RefundCategory category = RefundCategory.OTHER;

    @Enumerated(EnumType.STRING)
    @Column(name = "currency", nullable = false, length = 3)
    private Currency currency = Currency.USD;

    @Enumerated(EnumType.STRING)
    @Column(name = "refund_status", nullable = false, length = 20)
    private RefundStatus refundStatus = RefundStatus.PENDING;

    @Column(name = "requested_date", nullable = false, updatable = false)
    private LocalDateTime requestedDate;

    @Column(name = "processed_date")
    private LocalDateTime processedDate;

    @Column(name = "decision_note", length = 500)
    private String decisionNote;

    @Version
    @Column(nullable = false)
    private long version;

    @PrePersist
    protected void onCreate() {
        if (requestedDate == null) requestedDate = LocalDateTime.now();
        if (refundStatus == null) refundStatus = RefundStatus.PENDING;
        if (category == null) category = RefundCategory.OTHER;
        if (currency == null) currency = Currency.USD;
    }
}
