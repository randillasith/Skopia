package org.gp14.skopia.billing;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.gp14.skopia.model.subscription.*;
import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
public class BillingService {
    private final UserRepository users; private final SubscriptionRepository subscriptions; private final SubscriptionPlanRepository plans;
    private final PaymentRepository payments; private final RefundRepository refunds; private final ActivityLogRepository logs;
    private final EntityManager entityManager; private final boolean demoEnabled;
    private final org.gp14.skopia.notification.NotificationService notifications;
    public BillingService(UserRepository users, SubscriptionRepository subscriptions, SubscriptionPlanRepository plans,
            PaymentRepository payments, RefundRepository refunds, ActivityLogRepository logs, EntityManager entityManager,
            org.gp14.skopia.notification.NotificationService notifications,
            @Value("${skopia.billing.demo-enabled:false}") boolean demoEnabled) {
        this.users=users; this.subscriptions=subscriptions; this.plans=plans; this.payments=payments; this.refunds=refunds; this.logs=logs; this.entityManager=entityManager; this.demoEnabled=demoEnabled; this.notifications=notifications;
    }
    @Transactional(readOnly=true) public BillingDtos.Catalog plans(){return new BillingDtos.Catalog(demoEnabled,plans.findAll().stream().filter(p -> !Boolean.FALSE.equals(p.getActive())).map(SubscriptionPlanService::view).sorted(Comparator.comparing(BillingDtos.Plan::durationDays)).toList());}
    @Transactional(readOnly=true) public boolean hasActivePremium(Long id){return id!=null&&users.findById(id).filter(u->u instanceof Viewer&&"ACTIVE".equals(u.getAccountStatus())).isPresent()&&!active(id).isEmpty();}
    /** Re-evaluated for every delivery; legacy profile flags do not grant benefits. */
    @Transactional(readOnly = true)
    public boolean hasAdFreeSubscription(Long id) {
        if (id == null || users.findById(id)
                .filter(u -> u instanceof Viewer && "ACTIVE".equals(u.getAccountStatus())).isEmpty()) return false;
        return active(id).stream().anyMatch(s -> s.getPlan() != null
                && SubscriptionBenefits.isAdFree(s.getPlan()));
    }
    private List<Subscription> active(Long id){LocalDateTime now=LocalDateTime.now();return subscriptions.findByViewerIdAndSubStatusAndEndDateAfterOrderByEndDateDesc(id,"ACTIVE",now).stream().filter(s->!s.getStartDate().isAfter(now)).toList();}
    @Transactional(readOnly=true) public BillingDtos.Status status(Long id){requireViewer(id);return statusFor(id);}
    private BillingDtos.Status statusFor(Long id){var cur=active(id).stream().findFirst();if(cur.isPresent())return statusOf(cur.get(),"ACTIVE",true);var latest=subscriptions.findByViewerIdOrderByEndDateDescIdDesc(id).stream().findFirst();if(latest.isEmpty())return new BillingDtos.Status(false,null,null,null,null,"FREE",false);Subscription s=latest.get();String state="CANCELLED".equalsIgnoreCase(s.getSubStatus())?"CANCELLED":!s.getEndDate().isAfter(LocalDateTime.now())?"EXPIRED":s.getSubStatus().toUpperCase();return statusOf(s,state,false);}
    private BillingDtos.Status statusOf(Subscription s,String state,boolean premium){return new BillingDtos.Status(premium,s.getId(),s.getPlan().getPlanName(),s.getStartDate(),s.getEndDate(),state,premium && hasAdFreeSubscription(s.getViewer().getId()));}
    @Transactional(readOnly=true) public List<BillingDtos.PaymentView> payments(Long id){requireViewer(id);return payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(id).stream().map(this::paymentView).toList();}
    @Transactional(readOnly=true) public BillingDtos.PaymentView payment(Long id,Long paymentId){requireViewer(id);return payments.findByIdAndSubscriptionViewerId(paymentId,id).map(this::paymentView).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));}
    private BillingDtos.PaymentView paymentView(Payment p){
        String method=p.getPayMethod();
        String brand=method!=null&&method.startsWith("DEMO_TEST_VISA_")?"VISA":method!=null&&method.startsWith("DEMO_")?"DEMO":null;
        String last4=method!=null&&method.startsWith("DEMO_TEST_VISA_")?method.substring("DEMO_TEST_VISA_".length()):null;
        return new BillingDtos.PaymentView(p.getId(),p.getAmount(),p.getPaidDatetime(),method,p.getPayStatus(),
                p.getSubscription().getPlan().getPlanName(),p.getGatewayRef(),brand,last4);
    }

    @Transactional public BillingDtos.CheckoutResult checkout(Long id,String plan,String card,String expiry,String holder){enabled();validatePlan(plan);var v=lockedViewer(id);var current=active(id);if(current.stream().anyMatch(s->plan.equals(s.getPlan().getPlanName())))throw new ResponseStatusException(HttpStatus.CONFLICT,"That plan is already active");var test=DemoPaymentValidator.validate(card,expiry,holder);current.forEach(s->{s.setSubStatus("CANCELLED");s.setAutoRenew(false);});return activate(v,plan,"DEMO_TEST_VISA_"+test.last4());}
    @Transactional public BillingDtos.CheckoutResult changePlan(Long id,String plan){enabled();validatePlan(plan);Viewer v=lockedViewer(id);List<Subscription> current=active(id);if(current.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"No active subscription");if(current.stream().anyMatch(s->plan.equals(s.getPlan().getPlanName())))throw new ResponseStatusException(HttpStatus.CONFLICT,"That plan is already active");current.forEach(s->{s.setSubStatus("CANCELLED");s.setAutoRenew(false);});return activate(v,plan,"DEMO_PLAN_CHANGE");}
    private BillingDtos.CheckoutResult activate(Viewer viewer, String planName, String method) {
        return activate(viewer, planName, method, LocalDateTime.now());
    }

    private BillingDtos.CheckoutResult activate(Viewer viewer, String planName, String method, LocalDateTime renewalBase) {
        SubscriptionPlan plan = plans.findByPlanName(planName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported plan"));
        entityManager.refresh(plan, LockModeType.PESSIMISTIC_READ);
        if (Boolean.FALSE.equals(plan.getActive())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Plan has been retired");
        }
        if (plan.getPrice().compareTo(BigDecimal.ZERO) != 0 || plan.getDurationDays() <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Demo checkout requires a zero-price plan");
        }
        LocalDateTime now = LocalDateTime.now();
        Subscription subscription = new Subscription();
        subscription.setViewer(viewer);
        subscription.setPlan(plan);
        subscription.setStartDate(now);
        subscription.setEndDate(renewalBase.isAfter(now) ? renewalBase.plusDays(plan.getDurationDays()) : now.plusDays(plan.getDurationDays()));
        subscription.setSubStatus("ACTIVE");
        subscription.setAutoRenew(false);
        subscription = subscriptions.saveAndFlush(subscription);
        Payment payment = new Payment();
        payment.setSubscription(subscription);
        payment.setAmount(BigDecimal.ZERO.setScale(2));
        payment.setPaidDatetime(now);
        payment.setPayMethod(method);
        payment.setPayStatus("SIMULATED");
        payment.setGatewayRef("TEST-" + java.util.UUID.randomUUID());
        payment = payments.saveAndFlush(payment);
        syncPremium(viewer, true);
        notifications.create(viewer, "Demo payment confirmed", "Your " + planName + " subscription is active. No money was charged.",
                "PAYMENT_CONFIRMED", "/billing", "PAYMENT_CONFIRMED:" + payment.getId());
        return new BillingDtos.CheckoutResult(statusFor(viewer.getId()), paymentView(payment), subscriptionView(subscription));
    }
    @Transactional public BillingDtos.Status cancel(Long id){Viewer v=lockedViewer(id);List<Subscription> cur=active(id);if(cur.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"No active subscription");cur.forEach(s->{s.setSubStatus("CANCELLED");s.setAutoRenew(false);});syncPremium(v,false);return statusFor(id);}

    @Transactional(readOnly=true) public List<BillingDtos.RefundView> userRefunds(Long id){requireViewer(id);return refunds.findByPaymentSubscriptionViewerIdOrderByRequestedDateDesc(id).stream().map(this::refundView).toList();}
    @Transactional public BillingDtos.RefundView requestRefund(Long id,Long paymentId,String reason){requireViewer(id);String why=clean(reason,255,"Refund reason");Payment p=payments.findLockedByIdAndSubscriptionViewerId(paymentId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));if(refunds.existsByPaymentIdAndRefundStatus(paymentId,"PENDING"))throw new ResponseStatusException(HttpStatus.CONFLICT,"An open refund request already exists");Refund r=new Refund();r.setPayment(p);r.setRefundAmount(p.getAmount());r.setReason(why);r.setRefundStatus("PENDING");return refundView(refunds.save(r));}
    @Transactional(readOnly=true) public List<BillingDtos.RefundView> adminRefunds(){return refunds.findAllByOrderByRequestedDateDesc().stream().map(this::refundView).toList();}
    @Transactional public BillingDtos.RefundView decideRefund(User actor,Long refundId,String decision,String note){if(!(actor instanceof Administrator admin))throw new ResponseStatusException(actor==null?HttpStatus.UNAUTHORIZED:HttpStatus.FORBIDDEN);Refund r=refunds.findById(refundId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));entityManager.refresh(r,LockModeType.PESSIMISTIC_WRITE);if(!"PENDING".equals(r.getRefundStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Refund request is already final");String state=decision==null?"":decision.trim().toUpperCase();if(!List.of("APPROVED","REJECTED").contains(state))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Decision must be APPROVED or REJECTED");r.setRefundStatus(state);r.setProcessedBy(admin);r.setProcessedDate(LocalDateTime.now());r.setDecisionNote(note==null||note.isBlank()?null:clean(note,500,"Decision note"));User target=r.getPayment().getSubscription().getViewer();if("APPROVED".equals(state)){Subscription s=r.getPayment().getSubscription();s.setSubStatus("CANCELLED");s.setAutoRenew(false);syncPremium((Viewer)target,!active(target.getId()).stream().filter(other->!other.getId().equals(s.getId())).toList().isEmpty());}ActivityLog l=new ActivityLog();l.setUser(actor);l.setActor(actor);l.setTargetUser(target);l.setActionType("SIMULATED_REFUND_"+state);l.setDetail("refund="+r.getId()+" "+state+", payment="+r.getPayment().getId());l.setIpAddress("127.0.0.1");logs.save(l);return refundView(r);}
    private BillingDtos.RefundView refundView(Refund r){
        var proc=r.getProcessedBy();
        User owner=r.getPayment().getSubscription().getViewer();
        return new BillingDtos.RefundView(r.getId(),r.getPayment().getId(),r.getPayment().getSubscription().getId(),
                r.getPayment().getSubscription().getPlan().getPlanName(),r.getRefundAmount(),r.getReason(),r.getRefundStatus(),
                r.getRequestedDate(),proc==null?null:proc.getId(),proc==null?null:proc.getUsername(),
                proc==null?null:proc.getEmail(),r.getProcessedDate(),r.getDecisionNote(),owner.getUsername(),owner.getEmail());
    }

    @Transactional(readOnly=true)
    public List<BillingDtos.AdminUserSubscription> adminUsers(){
        return users.findAll().stream().filter(Viewer.class::isInstance).map(u->{
            var st=statusFor(u.getId());
            var latestPay=payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(u.getId()).stream().findFirst().orElse(null);
            var latestRefund=refunds.findByPaymentSubscriptionViewerIdOrderByRequestedDateDesc(u.getId()).stream().findFirst().orElse(null);
            String display=u.getFirstName()==null?u.getUsername():(u.getFirstName()+" "+(u.getLastName()==null?"":u.getLastName())).trim();
            return new BillingDtos.AdminUserSubscription(u.getId(),u.getUsername(),display,u.getEmail(),st.subscriptionId(),
                    st.planName(),st.status(),st.startDate(),st.endDate(),latestPay==null?null:paymentView(latestPay),
                    latestRefund==null?null:refundView(latestRefund));
        }).sorted(Comparator.comparing(BillingDtos.AdminUserSubscription::username)).toList();
    }
    @Transactional(readOnly = true)
    public List<BillingDtos.SubscriptionView> subscriptions(Long viewerId) {
        requireViewer(viewerId);
        return subscriptions.findByViewerIdOrderByEndDateDescIdDesc(viewerId).stream().map(this::subscriptionView).toList();
    }

    @Transactional(readOnly = true)
    public BillingDtos.SubscriptionView subscription(Long viewerId, Long subscriptionId) {
        requireViewer(viewerId);
        return subscriptionView(ownedSubscription(viewerId, subscriptionId));
    }

    @Transactional
    public BillingDtos.CheckoutResult updateSubscription(Long viewerId, Long subscriptionId, String planName) {
        lockedViewer(viewerId);
        Subscription subscription = ownedSubscription(viewerId, subscriptionId);
        if (!isCurrent(subscription)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an active subscription can change plan");
        return changePlan(viewerId, planName);
    }

    @Transactional
    public BillingDtos.SubscriptionView cancelSubscription(Long viewerId, Long subscriptionId) {
        Viewer viewer = lockedViewer(viewerId);
        Subscription subscription = ownedSubscription(viewerId, subscriptionId);
        // DELETE is idempotent cancellation, never destruction of billing history.
        if ("CANCELLED".equals(subscription.getSubStatus())) return subscriptionView(subscription);
        if (!isCurrent(subscription)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an active subscription can be cancelled");
        subscription.setSubStatus("CANCELLED");
        subscription.setAutoRenew(false);
        syncPremium(viewer, !active(viewerId).isEmpty());
        return subscriptionView(subscription);
    }

    @Transactional
    public BillingDtos.CheckoutResult renew(Long viewerId, Long subscriptionId, BillingDtos.DemoPaymentRequest request) {
        enabled();
        Viewer viewer = lockedViewer(viewerId);
        Subscription previous = ownedSubscription(viewerId, subscriptionId);
        if (!List.of("ACTIVE", "EXPIRED").contains(previous.getSubStatus()) || previous.getStartDate().isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an active or expired subscription can be renewed");
        }
        if (subscriptions.findByViewerIdOrderByEndDateDescIdDesc(viewerId).stream().findFirst()
                .filter(s -> s.getId().equals(subscriptionId)).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Renew the latest subscription");
        }
        var card = DemoPaymentValidator.validate(request.cardNumber(), request.expiry(), request.cardholderName());
        LocalDateTime base = previous.getEndDate();
        previous.setSubStatus(isCurrent(previous) ? "RENEWED" : "EXPIRED");
        previous.setAutoRenew(false);
        return activate(viewer, previous.getPlan().getPlanName(), "DEMO_TEST_VISA_" + card.last4(), base);
    }

    @Transactional(readOnly = true)
    public BillingDtos.Receipt receipt(Long viewerId, Long paymentId) {
        Viewer owner = requireViewer(viewerId);
        Payment payment = payments.findByIdAndSubscriptionViewerId(paymentId, viewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        Subscription subscription = payment.getSubscription();
        return new BillingDtos.Receipt("SKOPIA-" + payment.getId(), subscription.getId(), owner.getUsername(), owner.getEmail(),
                paymentView(payment), subscription.getStartDate(), subscription.getEndDate(), "SIMULATED".equals(payment.getPayStatus()));
    }

    @Transactional(readOnly = true)
    public BillingDtos.RefundView refund(Long viewerId, Long refundId) {
        requireViewer(viewerId);
        return refundView(refunds.findByIdAndPaymentSubscriptionViewerId(refundId, viewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Refund request not found")));
    }

    @Transactional
    public BillingDtos.RefundView updateRefund(Long viewerId, Long refundId, String reason) {
        Refund refund = pendingRefund(viewerId, refundId);
        refund.setReason(clean(reason, 255, "Refund reason"));
        return refundView(refund);
    }

    @Transactional
    public void cancelRefund(Long viewerId, Long refundId) {
        Refund refund = pendingRefund(viewerId, refundId);
        refund.setRefundStatus("CANCELLED");
        // Keep the request and original payment for the administrator's audit trail.
    }

    private Refund pendingRefund(Long viewerId, Long refundId) {
        requireViewer(viewerId);
        Refund refund = refunds.findLockedByIdAndPaymentSubscriptionViewerId(refundId, viewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Refund request not found"));
        entityManager.refresh(refund, LockModeType.PESSIMISTIC_WRITE);
        if (!"PENDING".equals(refund.getRefundStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a pending refund request can be changed");
        }
        return refund;
    }

    private Subscription ownedSubscription(Long viewerId, Long subscriptionId) {
        return subscriptions.findByIdAndViewerId(subscriptionId, viewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subscription not found"));
    }

    private boolean isCurrent(Subscription subscription) {
        LocalDateTime now = LocalDateTime.now();
        return "ACTIVE".equals(subscription.getSubStatus()) && !subscription.getStartDate().isAfter(now)
                && subscription.getEndDate().isAfter(now);
    }

    private BillingDtos.SubscriptionView subscriptionView(Subscription subscription) {
        String state = subscription.getSubStatus();
        if ("ACTIVE".equals(state) && !subscription.getEndDate().isAfter(LocalDateTime.now())) state = "EXPIRED";
        return new BillingDtos.SubscriptionView(subscription.getId(), subscription.getPlan().getPlanName(),
                subscription.getStartDate(), subscription.getEndDate(), state);
    }

    private Viewer requireViewer(Long id){if(id==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);User u=users.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Viewer required"));if(!(u instanceof Viewer v))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Viewer required");if(!"ACTIVE".equals(v.getAccountStatus()))throw new ResponseStatusException(HttpStatus.FORBIDDEN);return v;}
    private Viewer lockedViewer(Long id){Viewer v=requireViewer(id);entityManager.lock(v,LockModeType.PESSIMISTIC_WRITE);return v;}
    private void syncPremium(Viewer v,boolean value){if(v instanceof RegisteredViewer rv)rv.setIsPremium(value);}
    private void enabled(){if(!demoEnabled)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Demo billing disabled");}
    private void validatePlan(String name){if(name==null || plans.findByPlanName(name).isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported plan");}
    private String clean(String s,int max,String field){if(s==null||s.trim().isEmpty()||s.trim().length()>max)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,field+" must contain 1 to "+max+" characters");return s.trim();}
}
