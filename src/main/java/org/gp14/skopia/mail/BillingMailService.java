package org.gp14.skopia.mail;

import org.gp14.skopia.model.subscription.*;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Enqueues immutable plain-text messages in the caller's business transaction. Never sends mail. */
@Service
public class BillingMailService {
    /** Reserved outbox recipient key, never an SMTP address. */
    public static final String MAIN_ADMIN_RECIPIENT="@MAIN_ADMIN";
    /** Symbolic failure key, never routed to SMTP. Do not persist invalid stored email values. */
    public static final String INVALID_REQUESTER_RECIPIENT="@INVALID_REQUESTER";
    private final BillingMailOutboxRepository outbox;
    public BillingMailService(BillingMailOutboxRepository outbox) {
        this.outbox=outbox;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void receipt(BillingOrder order) {
        Subscription s=order.getSubscription();
        boolean complimentary="COMPLIMENTARY".equals(order.getMethod());
        String body=(complimentary ? "Skopia complimentary access confirmation\n\n" : "Skopia no-charge subscription receipt / access confirmation\n\n")
                +"Order reference: "+order.getReference()+"\nPlan: "+order.getPlanName()
                +"\nAccess: 30-day, nonrenewing pass\nStarts: "+s.getStartDate()
                +"\nEnds: "+s.getEndDate()+"\nListed monthly price: LKR 500\nAmount due: LKR 0\n"
                +(complimentary ? "Complimentary activation; no payment was made and there is no automatic renewal.\n"
                        : "This checkout used a test card. No payment was made, no money was charged, and there is no automatic renewal.\n");
        String event=(complimentary ? "COMPLIMENTARY_RECEIPT:" : "NO_CHARGE_RECEIPT:")+order.getId();
        String subject=complimentary ? "Skopia complimentary access confirmation" : "Skopia no-charge access confirmation";
        enqueue(event,order.getEmail(),subject,body);
        enqueue(event,MAIN_ADMIN_RECIPIENT,subject,body);
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void refund(Refund refund) {
        String state=refund.getRefundStatus().name();
        String body="Skopia simulated refund status\n\nRefund ID: "+refund.getId()
                +"\nStatus: "+state+"\nCategory: "+refund.getCategory()
                +"\nAmount: "+refund.getCurrency()+" "+refund.getRefundAmount()
                +"\nThis is a simulated refund workflow. No real money was moved or returned.\n"
                +"Log in to Skopia to view the full refund details and any decision note.\n";
        String event="REFUND_"+state+":"+refund.getId();
        enqueue(event,refund.getPayment().getSubscription().getViewer().getEmail(),"Skopia simulated refund "+state.toLowerCase(),body);
        enqueue(event,MAIN_ADMIN_RECIPIENT,"Skopia simulated refund "+state.toLowerCase(),body);
    }
    private void enqueue(String event,String recipient,String subject,String body) {
        boolean invalid=!MAIN_ADMIN_RECIPIENT.equals(recipient) && !BillingMailAddress.valid(recipient);
        String address=invalid ? INVALID_REQUESTER_RECIPIENT :
                MAIN_ADMIN_RECIPIENT.equals(recipient) ? recipient : recipient.toLowerCase(java.util.Locale.ROOT);
        if(outbox.existsByEventKeyAndRecipient(event,address)) return;
        BillingMailOutbox row=new BillingMailOutbox(); row.setEventKey(event); row.setRecipient(address);
        row.setSubject(subject); row.setBody(body);
        if(invalid) { row.setStatus("FAILED"); row.setLastError("Invalid stored requester email"); }
        outbox.save(row);
    }
}
