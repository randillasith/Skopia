package org.gp14.skopia.repository;

import org.gp14.skopia.model.subscription.RefundStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RefundStatusHistoryRepository extends JpaRepository<RefundStatusHistory, Long> {
    List<RefundStatusHistory> findByRefundIdOrderByChangedAtAscIdAsc(Long refundId);
}
