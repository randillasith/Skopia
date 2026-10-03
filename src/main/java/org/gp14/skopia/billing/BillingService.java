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
    public BillingService(UserRepository users, SubscriptionRepository subscriptions, SubscriptionPlanRepository plans,
            PaymentRepository payments, RefundRepository refunds, ActivityLogRepository logs, EntityManager entityManager,
            @Value("${skopia.billing.demo-enabled:false}") boolean demoEnabled) {
        this.users=users; this.subscriptions=subscriptions; this.plans=plans; this.payments=payments; this.refunds=refunds; this.logs=logs; this.entityManager=entityManager; this.demoEnabled=demoEnabled;
    }
    @Transactional(readOnly=true) public BillingDtos.Catalog plans(){return new BillingDtos.Catalog(demoEnabled,plans.findAll().stream().filter(p->List.of("MONTHLY","YEARLY").contains(p.getPlanName())).map(p->new BillingDtos.Plan(p.getId(),p.getPlanName(),p.getDurationDays(),p.getPrice(),p.getBenefit())).sorted(Comparator.comparing(BillingDtos.Plan::durationDays)).toList());}
    @Transactional(readOnly=true) public boolean hasActivePremium(Long id){return id!=null&&users.findById(id).filter(u->u instanceof Viewer&&"ACTIVE".equals(u.getAccountStatus())).isPresent()&&!active(id).isEmpty();}
    private List<Subscription> active(Long id){LocalDateTime now=LocalDateTime.now();return subscriptions.findByViewerIdAndSubStatusAndEndDateAfterOrderByEndDateDesc(id,"ACTIVE",now).stream().filter(s->!s.getStartDate().isAfter(now)).toList();}
    @Transactional(readOnly=true) public BillingDtos.Status status(Long id){requireViewer(id);return statusFor(id);}
    private BillingDtos.Status statusFor(Long id){var cur=active(id).stream().findFirst();if(cur.isPresent())return statusOf(cur.get(),"ACTIVE",true);var latest=subscriptions.findByViewerIdOrderByEndDateDescIdDesc(id).stream().findFirst();if(latest.isEmpty())return new BillingDtos.Status(false,null,null,null,null,"FREE");Subscription s=latest.get();String state="CANCELLED".equalsIgnoreCase(s.getSubStatus())?"CANCELLED":!s.getEndDate().isAfter(LocalDateTime.now())?"EXPIRED":s.getSubStatus().toUpperCase();return statusOf(s,state,false);}
    private BillingDtos.Status statusOf(Subscription s,String state,boolean premium){return new BillingDtos.Status(premium,s.getId(),s.getPlan().getPlanName(),s.getStartDate(),s.getEndDate(),state);}
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
    private BillingDtos.CheckoutResult activate(Viewer v,String planName,String method){SubscriptionPlan plan=plans.findByPlanName(planName).orElseThrow(()->new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Demo plan unavailable"));if(plan.getPrice().compareTo(BigDecimal.ZERO)!=0||plan.getDurationDays()<=0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Not a demo plan");LocalDateTime now=LocalDateTime.now();Subscription s=new Subscription();s.setViewer(v);s.setPlan(plan);s.setStartDate(now);s.setEndDate(now.plusDays(plan.getDurationDays()));s.setSubStatus("ACTIVE");s.setAutoRenew(false);s=subscriptions.saveAndFlush(s);Payment p=new Payment();p.setSubscription(s);p.setAmount(BigDecimal.ZERO.setScale(2));p.setPaidDatetime(now);p.setPayMethod(method);p.setPayStatus("SIMULATED");p.setGatewayRef("TEST-"+java.util.UUID.randomUUID());p=payments.saveAndFlush(p);syncPremium(v,true);return new BillingDtos.CheckoutResult(statusFor(v.getId()),paymentView(p),new BillingDtos.SubscriptionView(s.getId(),planName,now,s.getEndDate(),s.getSubStatus()));}
    @Transactional public BillingDtos.Status cancel(Long id){Viewer v=lockedViewer(id);List<Subscription> cur=active(id);if(cur.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"No active subscription");cur.forEach(s->{s.setSubStatus("CANCELLED");s.setAutoRenew(false);});syncPremium(v,false);return statusFor(id);}

    @Transactional(readOnly=true) public List<BillingDtos.RefundView> userRefunds(Long id){requireViewer(id);return refunds.findByPaymentSubscriptionViewerIdOrderByRequestedDateDesc(id).stream().map(this::refundView).toList();}
    @Transactional public BillingDtos.RefundView requestRefund(Long id,Long paymentId,String reason){requireViewer(id);String why=clean(reason,255,"Refund reason");Payment p=payments.findLockedByIdAndSubscriptionViewerId(paymentId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));if(refunds.existsByPaymentIdAndRefundStatus(paymentId,"PENDING"))throw new ResponseStatusException(HttpStatus.CONFLICT,"An open refund request already exists");Refund r=new Refund();r.setPayment(p);r.setRefundAmount(p.getAmount());r.setReason(why);r.setRefundStatus("PENDING");return refundView(refunds.save(r));}
    @Transactional(readOnly=true) public List<BillingDtos.RefundView> adminRefunds(){return refunds.findAllByOrderByRequestedDateDesc().stream().map(this::refundView).toList();}
    @Transactional public BillingDtos.RefundView decideRefund(User actor,Long refundId,String decision,String note){if(!(actor instanceof Administrator admin))throw new ResponseStatusException(actor==null?HttpStatus.UNAUTHORIZED:HttpStatus.FORBIDDEN);Refund r=refunds.findById(refundId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));entityManager.lock(r,LockModeType.PESSIMISTIC_WRITE);if(!"PENDING".equals(r.getRefundStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Refund request is already final");String state=decision==null?"":decision.trim().toUpperCase();if(!List.of("APPROVED","REJECTED").contains(state))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Decision must be APPROVED or REJECTED");r.setRefundStatus(state);r.setProcessedBy(admin);r.setProcessedDate(LocalDateTime.now());r.setDecisionNote(note==null||note.isBlank()?null:clean(note,500,"Decision note"));User target=r.getPayment().getSubscription().getViewer();if("APPROVED".equals(state)){Subscription s=r.getPayment().getSubscription();s.setSubStatus("CANCELLED");s.setAutoRenew(false);syncPremium((Viewer)target,!active(target.getId()).stream().filter(other->!other.getId().equals(s.getId())).toList().isEmpty());}ActivityLog l=new ActivityLog();l.setUser(actor);l.setActor(actor);l.setTargetUser(target);l.setActionType("SIMULATED_REFUND_"+state);l.setDetail("refund="+r.getId()+" "+state+", payment="+r.getPayment().getId());l.setIpAddress("127.0.0.1");logs.save(l);return refundView(r);}
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
    private Viewer requireViewer(Long id){if(id==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);User u=users.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Viewer required"));if(!(u instanceof Viewer v))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Viewer required");if(!"ACTIVE".equals(v.getAccountStatus()))throw new ResponseStatusException(HttpStatus.FORBIDDEN);return v;}
    private Viewer lockedViewer(Long id){Viewer v=requireViewer(id);entityManager.lock(v,LockModeType.PESSIMISTIC_WRITE);return v;}
    private void syncPremium(Viewer v,boolean value){if(v instanceof RegisteredViewer rv)rv.setIsPremium(value);}
    private void enabled(){if(!demoEnabled)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Demo billing disabled");}
    private void validatePlan(String p){if(!List.of("MONTHLY","YEARLY").contains(p))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported plan");}
    private String clean(String s,int max,String field){if(s==null||s.trim().isEmpty()||s.trim().length()>max)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,field+" must contain 1 to "+max+" characters");return s.trim();}
}
