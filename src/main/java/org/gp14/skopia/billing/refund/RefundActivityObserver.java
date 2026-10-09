package org.gp14.skopia.billing.refund;

import org.gp14.skopia.model.subscription.RefundStatus;
import org.gp14.skopia.model.user.ActivityLog;
import org.gp14.skopia.repository.ActivityLogRepository;
import org.springframework.stereotype.Component;

/** Concrete observer that records administrator approval and rejection decisions. */
@Component
public class RefundActivityObserver implements RefundStatusObserver {
    private final ActivityLogRepository logs;

    public RefundActivityObserver(ActivityLogRepository logs) {
        this.logs = logs;
    }

    @Override
    public void onRefundStatusChanged(RefundStatusChangedEvent event) {
        if (event.currentStatus() != RefundStatus.APPROVED
                && event.currentStatus() != RefundStatus.REJECTED) {
            return;
        }
        ActivityLog log = new ActivityLog();
        log.setUser(event.actor());
        log.setActor(event.actor());
        log.setTargetUser(event.owner());
        log.setActionType("SIMULATED_REFUND_" + event.currentStatus().name());
        log.setDetail("refund=" + event.refund().getId() + " " + event.currentStatus().name()
                + ", payment=" + event.refund().getPayment().getId());
        log.setIpAddress("127.0.0.1");
        logs.save(log);
    }
}
