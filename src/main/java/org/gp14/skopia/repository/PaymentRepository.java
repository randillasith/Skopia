package org.gp14.skopia.repository;

import jakarta.persistence.LockModeType;
import org.gp14.skopia.model.subscription.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findBySubscriptionId(Long subscriptionId);
    List<Payment> findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(Long viewerId);
    java.util.Optional<Payment> findByIdAndSubscriptionViewerId(Long id, Long viewerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    java.util.Optional<Payment> findLockedByIdAndSubscriptionViewerId(Long id, Long viewerId);
}
