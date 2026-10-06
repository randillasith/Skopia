package org.gp14.skopia.repository;

import org.gp14.skopia.model.subscription.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    List<Subscription> findByViewerId(Long viewerId);
    List<Subscription> findByViewerIdAndSubStatus(Long viewerId, String subStatus);
    List<Subscription> findByViewerIdAndSubStatusAndEndDateAfterOrderByEndDateDesc(Long viewerId, String subStatus, java.time.LocalDateTime now);
    List<Subscription> findByViewerIdOrderByEndDateDescIdDesc(Long viewerId);
    java.util.Optional<Subscription> findByIdAndViewerId(Long id, Long viewerId);
    boolean existsByPlanId(Long planId);
    List<Subscription> findBySubStatusAndEndDateAfterAndEndDateLessThanEqual(
            String status, java.time.LocalDateTime from, java.time.LocalDateTime until);
}
