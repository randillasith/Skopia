package org.gp14.skopia.repository;

import org.gp14.skopia.model.subscription.BillingOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface BillingOrderRepository extends JpaRepository<BillingOrder,Long> {
    List<BillingOrder> findByOwnerIdOrderBySubmittedAtDescIdDesc(Long ownerId);
    List<BillingOrder> findAllByOrderBySubmittedAtDescIdDesc();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from BillingOrder o where o.id = :id") Optional<BillingOrder> lockedById(Long id);
}
