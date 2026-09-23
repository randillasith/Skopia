package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "staff")
@PrimaryKeyJoinColumn(name = "employee_no")
@Getter
@Setter
@NoArgsConstructor
public class Staff extends User {

    @Column(nullable = false, length = 100)
    private String designation;

    @Column(name = "hire_date", nullable = false)
    private LocalDate hireDate;
}
