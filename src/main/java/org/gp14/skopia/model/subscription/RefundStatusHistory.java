package org.gp14.skopia.model.subscription;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.User;

import java.time.LocalDateTime;

@Entity
@Table(name = "refund_status_history", indexes = {
        @Index(name = "idx_refund_history_refund_changed", columnList = "refund_id,changed_at")
})
@Getter
@Setter
@NoArgsConstructor
public class RefundStatusHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "refund_id", nullable = false)
    private Refund refund;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    private RefundStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    private RefundStatus toStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    private User changedBy;

    @Column(name = "change_note", length = 500)
    private String changeNote;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime changedAt;

    @PrePersist
    protected void onCreate() {
        if (changedAt == null) changedAt = LocalDateTime.now();
    }
}
