package org.gp14.skopia.billing.refund;

import org.gp14.skopia.model.subscription.Refund;
import org.gp14.skopia.model.subscription.RefundStatus;
import org.gp14.skopia.model.user.User;

import java.util.Objects;

/** Immutable notification sent by the refund subject after a persisted lifecycle transition. */
public record RefundStatusChangedEvent(
        Refund refund,
        RefundStatus previousStatus,
        RefundStatus currentStatus,
        User actor
) {
    public RefundStatusChangedEvent {
        Objects.requireNonNull(refund, "refund");
        Objects.requireNonNull(currentStatus, "currentStatus");
        Objects.requireNonNull(actor, "actor");
    }

    public User owner() {
        return refund.getPayment().getSubscription().getViewer();
    }
}
