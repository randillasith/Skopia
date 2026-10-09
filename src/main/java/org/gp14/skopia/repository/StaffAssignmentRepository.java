package org.gp14.skopia.repository;

import org.gp14.skopia.model.user.StaffAssignment;
import org.gp14.skopia.model.user.StaffType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface StaffAssignmentRepository extends JpaRepository<StaffAssignment, Long> {
    boolean existsByOfficerCodeIgnoreCase(String officerCode);
    List<StaffAssignment> findByStaffType(StaffType staffType);
    long countByStaffType(StaffType staffType);
}
