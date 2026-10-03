package org.gp14.skopia.billing;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.gp14.skopia.model.subscription.Payment;
import org.gp14.skopia.model.subscription.Subscription;
import org.gp14.skopia.model.subscription.SubscriptionPlan;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.PaymentRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.repository.SubscriptionPlanRepository;
import org.gp14.skopia.repository.SubscriptionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class BillingService {
    private final RegisteredViewerRepository viewers;
    private final SubscriptionRepository subscriptions;
    private final SubscriptionPlanRepository plans;
    private final PaymentRepository payments;
    private final EntityManager entityManager;
    private final boolean demoEnabled;

    public BillingService(RegisteredViewerRepository viewers, SubscriptionRepository subscriptions,
                          SubscriptionPlanRepository plans, PaymentRepository payments, EntityManager entityManager,
                          @Value("${skopia.billing.demo-enabled:false}") boolean demoEnabled) {
        this.viewers = viewers;
        this.subscriptions = subscriptions;
        this.plans = plans;
        this.payments = payments;
        this.entityManager = entityManager;
        this.demoEnabled = demoEnabled;
    }

    @Transactional(readOnly = true)
    public BillingDtos.Catalog plans() {
        return new BillingDtos.Catalog(demoEnabled, plans.findAll().stream()
                .filter(p -> "MONTHLY".equals(p.getPlanName()) || "YEARLY".equals(p.getPlanName()))
                .map(p -> new BillingDtos.Plan(p.getId(), p.getPlanName(), p.getDurationDays(), p.getPrice(), p.getBenefit()))
                .sorted(java.util.Comparator.comparing(BillingDtos.Plan::durationDays)).toList());
    }

    /** A live subscription is the authority; the legacy isPremium flag alone never grants access. */
    @Transactional(readOnly = true)
    public boolean hasActivePremium(Long userId) {
        if (userId == null) return false;
        return viewers.findById(userId).filter(v -> "ACTIVE".equals(v.getAccountStatus()))
                .isPresent() && !active(userId).isEmpty();
    }

    private List<Subscription> active(Long userId) {
        return subscriptions.findByViewerIdAndSubStatusAndEndDateAfterOrderByEndDateDesc(
                userId, "ACTIVE", LocalDateTime.now()).stream()
                .filter(s -> !s.getStartDate().isAfter(LocalDateTime.now())).toList();
    }

    @Transactional(readOnly = true)
    public BillingDtos.Status status(Long userId) {
        requireViewer(userId);
        return statusFor(userId);
    }

    private BillingDtos.Status statusFor(Long userId) {
        var current = active(userId).stream().findFirst();
        return current.map(s -> new BillingDtos.Status(true, s.getPlan().getPlanName(), s.getEndDate(), "ACTIVE"))
                .orElseGet(() -> new BillingDtos.Status(false, null, null, "INACTIVE"));
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.PaymentView> payments(Long userId) {
        requireViewer(userId);
        return payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(userId)
                .stream().map(this::paymentView).toList();
    }

    @Transactional(readOnly = true)
    public BillingDtos.PaymentView payment(Long userId, Long paymentId) {
        requireViewer(userId);
        return payments.findByIdAndSubscriptionViewerId(paymentId, userId)
                .map(this::paymentView).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private BillingDtos.PaymentView paymentView(Payment p) {
        return new BillingDtos.PaymentView(p.getId(), p.getAmount(), p.getPaidDatetime(),
                p.getPayMethod(), p.getPayStatus(), p.getSubscription().getPlan().getPlanName());
    }

    @Transactional
    public BillingDtos.CheckoutResult checkout(Long userId, String planName) {
        if (!demoEnabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Demo checkout disabled");
        if (!"MONTHLY".equals(planName) && !"YEARLY".equals(planName))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported plan");
        RegisteredViewer viewer = lockedViewer(userId);
        if (!active(userId).isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Active subscription exists");
        SubscriptionPlan plan = plans.findByPlanName(planName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Demo plan unavailable"));
        // A pre-existing paid catalog entry must not be mistaken for a charged checkout.
        if (plan.getPrice().compareTo(BigDecimal.ZERO) != 0 || plan.getDurationDays() <= 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Not a demo plan");
        LocalDateTime now = LocalDateTime.now();
        Subscription sub = new Subscription();
        sub.setViewer(viewer); sub.setPlan(plan); sub.setStartDate(now);
        sub.setEndDate(now.plusDays(plan.getDurationDays()));
        sub.setSubStatus("ACTIVE"); sub.setAutoRenew(false);
        sub = subscriptions.saveAndFlush(sub);
        Payment payment = new Payment();
        payment.setSubscription(sub); payment.setAmount(BigDecimal.ZERO.setScale(2));
        payment.setPaidDatetime(now); payment.setPayMethod("DEMO_NO_CHARGE");
        payment.setPayStatus("SIMULATED");
        payment = payments.saveAndFlush(payment);
        viewer.setIsPremium(true);
        return new BillingDtos.CheckoutResult(statusFor(userId), paymentView(payment),
                new BillingDtos.SubscriptionView(sub.getId(), planName, now, sub.getEndDate(), sub.getSubStatus()));
    }

    @Transactional
    public BillingDtos.Status cancel(Long userId) {
        RegisteredViewer viewer = lockedViewer(userId);
        List<Subscription> current = active(userId);
        if (current.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "No active subscription");
        for (Subscription sub : current) {
            sub.setSubStatus("CANCELLED"); sub.setAutoRenew(false);
        }
        viewer.setIsPremium(false);
        return statusFor(userId);
    }

    private RegisteredViewer requireViewer(Long userId) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        RegisteredViewer v = viewers.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Registered viewer required"));
        if (!"ACTIVE".equals(v.getAccountStatus())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return v;
    }

    private RegisteredViewer lockedViewer(Long userId) {
        RegisteredViewer v = requireViewer(userId);
        entityManager.lock(v, LockModeType.PESSIMISTIC_WRITE);
        return v;
    }
}
