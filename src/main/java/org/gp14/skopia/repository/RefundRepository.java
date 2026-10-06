package org.gp14.skopia.repository;

import jakarta.persistence.LockModeType;
import org.gp14.skopia.model.subscription.Refund;
import org.gp14.skopia.model.subscription.RefundStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

public interface RefundRepository extends JpaRepository<Refund, Long>, JpaSpecificationExecutor<Refund> {
    List<Refund> findByPaymentSubscriptionViewerIdOrderByRequestedDateDesc(Long viewerId);
    Optional<Refund> findByIdAndPaymentSubscriptionViewerId(Long id, Long viewerId);
    boolean existsByPaymentId(Long paymentId);
    long countByRefundStatus(RefundStatus status);
    List<Refund> findAllByOrderByRequestedDateDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Refund> findLockedById(Long id);
}
