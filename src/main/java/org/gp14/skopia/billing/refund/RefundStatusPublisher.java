package org.gp14.skopia.billing.refund;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/** Concrete subject. Spring supplies every RefundStatusObserver implementation. */
@Component
public class RefundStatusPublisher implements RefundEventSubject {
    private final List<RefundStatusObserver> observers;

    public RefundStatusPublisher(List<RefundStatusObserver> observers) {
        this.observers = List.copyOf(observers);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void notifyObservers(RefundStatusChangedEvent event) {
        Objects.requireNonNull(event, "event");
        observers.forEach(observer -> observer.onRefundStatusChanged(event));
    }
}
