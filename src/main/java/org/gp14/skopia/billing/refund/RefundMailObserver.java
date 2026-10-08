package org.gp14.skopia.billing.refund;

import org.gp14.skopia.mail.BillingMailService;
import org.springframework.stereotype.Component;

/** Concrete observer that writes the durable refund email snapshot to the transactional outbox. */
@Component
public class RefundMailObserver implements RefundStatusObserver {
    private final BillingMailService billingMail;

    public RefundMailObserver(BillingMailService billingMail) {
        this.billingMail = billingMail;
    }

    @Override
    public void onRefundStatusChanged(RefundStatusChangedEvent event) {
        billingMail.refund(event.refund());
    }
}
