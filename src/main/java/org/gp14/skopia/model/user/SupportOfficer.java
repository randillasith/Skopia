package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "support_officers")
@PrimaryKeyJoinColumn(name = "employee_no")
@Getter
@Setter
@NoArgsConstructor
public class SupportOfficer extends Staff {

    @Column(name = "support_level", nullable = false, length = 50)
    private String supportLevel;

    @Column(length = 50)
    private String shift;
}
