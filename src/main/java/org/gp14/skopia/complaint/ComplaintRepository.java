package org.gp14.skopia.complaint;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    List<Complaint> findByStatus(ComplaintStatus status);
    Optional<Complaint> findByReportId(Long reportId);
    List<Complaint> findByAssignedOfficerId(Long officerId);
    List<Complaint> findByReportingViewerId(Long viewerId);
    List<Complaint> findByReportId(Long reportId);
    List<Complaint> findByStatusAndPriority(ComplaintStatus status, ComplaintPriority priority);
    List<Complaint> findAllByOrderByCreatedAtDesc();
}
