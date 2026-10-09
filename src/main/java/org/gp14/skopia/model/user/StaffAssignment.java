package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "staff_assignments", uniqueConstraints = @UniqueConstraint(name = "uq_staff_assignment_officer_code", columnNames = "officer_code"))
@Getter @Setter @NoArgsConstructor
public class StaffAssignment {
    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_staff_assignment_user"))
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "staff_type", nullable = false, length = 40)
    private StaffType staffType;

    @Column(nullable = false, length = 100)
    private String designation;

    @Column(name = "hire_date", nullable = false)
    private LocalDate hireDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_level", length = 30)
    private AdminLevel adminLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "support_level", length = 30)
    private SupportLevel supportLevel;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private SupportShift shift;

    @Column(name = "officer_code", length = 50)
    private String officerCode;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private MarketingDepartment department;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist void create() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate void update() { updatedAt = LocalDateTime.now(); }
}
