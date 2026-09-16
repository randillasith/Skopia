package org.gp14.skopia.model.subscription;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "payment_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subscription_id", nullable = false)
    private Subscription subscription;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "paid_datetime", nullable = false)
    private LocalDateTime paidDatetime;

    @Column(name = "pay_method", nullable = false, length = 50)
    private String payMethod;

    @Column(name = "pay_status", nullable = false, length = 20)
    private String payStatus = "COMPLETED";

    @Column(name = "gateway_ref", length = 100)
    private String gatewayRef;

    @PrePersist
    protected void onCreate() {
        if (paidDatetime == null) {
            paidDatetime = LocalDateTime.now();
        }
    }
}
