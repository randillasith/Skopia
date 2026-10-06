package org.gp14.skopia.repository;
import org.gp14.skopia.model.subscription.Refund;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface RefundRepository extends JpaRepository<Refund, Long> {
    List<Refund> findByPaymentSubscriptionViewerIdOrderByRequestedDateDesc(Long viewerId);
    Optional<Refund> findByIdAndPaymentSubscriptionViewerId(Long id, Long viewerId);
    boolean existsByPaymentIdAndRefundStatus(Long paymentId, String status);
    List<Refund> findAllByOrderByRequestedDateDesc();

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<Refund> findLockedByIdAndPaymentSubscriptionViewerId(Long id, Long viewerId);

}
