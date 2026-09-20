package org.gp14.skopia.repository;

import org.gp14.skopia.model.user.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findByUserIdOrderByActionTimeDesc(Long userId);
    List<ActivityLog> findByActionTypeContainingIgnoreCaseOrderByActionTimeDesc(String actionType);
    List<ActivityLog> findAllByOrderByActionTimeDesc();
}
