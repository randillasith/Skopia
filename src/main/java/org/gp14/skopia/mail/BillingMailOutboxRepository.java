package org.gp14.skopia.mail;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BillingMailOutboxRepository extends JpaRepository<BillingMailOutbox,Long> {
    boolean existsByEventKeyAndRecipient(String eventKey, String recipient);
    @Query("select m.id from BillingMailOutbox m where (m.status = 'PENDING' or m.status = 'SENDING') and m.nextAttemptAt <= :now order by case when m.recipient = '@MAIN_ADMIN' then 1 else 0 end, m.nextAttemptAt, m.id")
    List<Long> due(LocalDateTime now, Pageable page);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from BillingMailOutbox m where m.id = :id")
    Optional<BillingMailOutbox> locked(Long id);
}
