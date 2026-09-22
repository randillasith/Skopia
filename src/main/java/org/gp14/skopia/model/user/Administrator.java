package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "administrators")
@PrimaryKeyJoinColumn(name = "employee_no")
@Getter
@Setter
@NoArgsConstructor
public class Administrator extends Staff {

    @Column(name = "admin_level", nullable = false, length = 50)
    private String adminLevel;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;
}
