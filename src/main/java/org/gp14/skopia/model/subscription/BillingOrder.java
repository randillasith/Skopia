package org.gp14.skopia.model.subscription;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.gp14.skopia.model.user.User;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name="billing_orders", uniqueConstraints=@UniqueConstraint(name="uk_billing_order_reference",columnNames="order_reference"))
@Getter @Setter
public class BillingOrder {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) @Column(name="order_id") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="owner_id",nullable=false) private User owner;
    @Column(name="order_reference",nullable=false,length=80) private String reference;
    @Column(name="plan_name",nullable=false,length=30) private String planName;
    @Column(nullable=false,precision=10,scale=2) private BigDecimal amount;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=3) private Currency currency;
    @Column(nullable=false,length=30) private String method;
    @Column(length=20) private String brand;
    @Column(nullable=false,length=30) private String status;
    @Column(name="billing_name",nullable=false,length=120) private String fullName;
    @Column(name="billing_email",nullable=false,length=254) private String email;
    @Column(name="billing_phone",nullable=false,length=30) private String phone;
    @Column(name="billing_address1",nullable=false,length=200) private String addressLine1;
    @Column(name="billing_address2",length=200) private String addressLine2;
    @Column(name="billing_city",nullable=false,length=100) private String city;
    @Column(name="billing_postal",nullable=false,length=20) private String postalCode;
    @Column(name="billing_country",nullable=false,length=2) private String country;
    @Column(name="transfer_reference",length=100) private String transferReference;
    @Column(name="slip_key",length=80) private String slipKey;
    @Column(name="slip_type",length=30) private String slipType;
    @Column(name="submitted_at",nullable=false) private LocalDateTime submittedAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="decided_by") private User decidedBy;
    @Column(name="decided_at") private LocalDateTime decidedAt;
    @Column(name="decision_note",length=500) private String decisionNote;
    @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="payment_id",unique=true) private Payment payment;
    @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="subscription_id",unique=true) private Subscription subscription;
}
