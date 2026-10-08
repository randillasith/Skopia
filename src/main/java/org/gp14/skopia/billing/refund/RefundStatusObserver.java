package org.gp14.skopia.billing.refund;

/** Observer contract for every component interested in refund lifecycle changes. */
public interface RefundStatusObserver {
    void onRefundStatusChanged(RefundStatusChangedEvent event);
}
