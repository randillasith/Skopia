package org.gp14.skopia.complaint;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    List<Complaint> findByStatus(ComplaintStatus status);
    List<Complaint> findByAssignedOfficerId(Long officerId);
    List<Complaint> findByReportingViewerId(Long viewerId);
    List<Complaint> findByStatusAndPriority(ComplaintStatus status, ComplaintPriority priority);
}
