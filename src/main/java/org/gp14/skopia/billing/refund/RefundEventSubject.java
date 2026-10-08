package org.gp14.skopia.billing.refund;

/** Subject contract used by refund application services to notify registered observers. */
public interface RefundEventSubject {
    void notifyObservers(RefundStatusChangedEvent event);
}
