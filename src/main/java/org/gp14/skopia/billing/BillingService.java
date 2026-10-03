package org.gp14.skopia.billing;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.gp14.skopia.model.subscription.Payment;
import org.gp14.skopia.model.subscription.Subscription;
import org.gp14.skopia.model.subscription.SubscriptionPlan;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.model.user.Viewer;
import org.gp14.skopia.repository.PaymentRepository;
import org.gp14.skopia.repository.SubscriptionPlanRepository;
import org.gp14.skopia.repository.SubscriptionRepository;
import org.gp14.skopia.repository.UserRepository;
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
    private final UserRepository users;
    private final SubscriptionRepository subscriptions;
    private final SubscriptionPlanRepository plans;
    private final PaymentRepository payments;
    private final EntityManager entityManager;
    private final boolean demoEnabled;

    public BillingService(UserRepository users, SubscriptionRepository subscriptions,
                          SubscriptionPlanRepository plans, PaymentRepository payments, EntityManager entityManager,
                          @Value("${skopia.billing.demo-enabled:false}") boolean demoEnabled) {
        this.users = users; this.subscriptions = subscriptions; this.plans = plans;
        this.payments = payments; this.entityManager = entityManager; this.demoEnabled = demoEnabled;
    }

    @Transactional(readOnly = true)
    public BillingDtos.Catalog plans() {
        return new BillingDtos.Catalog(demoEnabled, plans.findAll().stream()
                .filter(p -> "MONTHLY".equals(p.getPlanName()) || "YEARLY".equals(p.getPlanName()))
                .map(p -> new BillingDtos.Plan(p.getId(), p.getPlanName(), p.getDurationDays(), p.getPrice(), p.getBenefit()))
                .sorted(Comparator.comparing(BillingDtos.Plan::durationDays)).toList());
    }

    @Transactional(readOnly = true)
    public boolean hasActivePremium(Long userId) {
        if (userId == null) return false;
        return users.findById(userId).filter(u -> u instanceof Viewer && "ACTIVE".equals(u.getAccountStatus()))
                .isPresent() && !active(userId).isEmpty();
    }

    private List<Subscription> active(Long userId) {
        LocalDateTime now = LocalDateTime.now();
        return subscriptions.findByViewerIdAndSubStatusAndEndDateAfterOrderByEndDateDesc(userId, "ACTIVE", now)
                .stream().filter(s -> !s.getStartDate().isAfter(now)).toList();
    }

    @Transactional(readOnly = true)
    public BillingDtos.Status status(Long userId) { requireViewer(userId); return statusFor(userId); }

    private BillingDtos.Status statusFor(Long userId) {
        var current = active(userId).stream().findFirst();
        if (current.isPresent()) return statusOf(current.get(), "ACTIVE", true);
        var latest = subscriptions.findByViewerIdOrderByEndDateDescIdDesc(userId).stream().findFirst();
        if (latest.isEmpty()) return new BillingDtos.Status(false, null, null, null, "FREE");
        Subscription sub = latest.get();
        String state = "CANCELLED".equalsIgnoreCase(sub.getSubStatus()) ? "CANCELLED"
                : sub.getEndDate().isBefore(LocalDateTime.now()) || sub.getEndDate().isEqual(LocalDateTime.now()) ? "EXPIRED"
                : sub.getSubStatus().toUpperCase();
        return statusOf(sub, state, false);
    }

    private BillingDtos.Status statusOf(Subscription sub, String state, boolean premium) {
        return new BillingDtos.Status(premium, sub.getPlan().getPlanName(), sub.getStartDate(), sub.getEndDate(), state);
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.PaymentView> payments(Long userId) {
        requireViewer(userId);
        return payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(userId).stream().map(this::paymentView).toList();
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
    public BillingDtos.CheckoutResult checkout(Long userId, String planName, String cardNumber, String expiry, String cardholderName) {
        if (!demoEnabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Demo checkout disabled");
        if (!"MONTHLY".equals(planName) && !"YEARLY".equals(planName))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported plan");
        DemoPaymentValidator.Validated testPayment = DemoPaymentValidator.validate(cardNumber, expiry, cardholderName);
        Viewer viewer = lockedViewer(userId);
        if (!active(userId).isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Active subscription exists");
        SubscriptionPlan plan = plans.findByPlanName(planName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Demo plan unavailable"));
        if (plan.getPrice().compareTo(BigDecimal.ZERO) != 0 || plan.getDurationDays() <= 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Not a demo plan");
        LocalDateTime now = LocalDateTime.now();
        Subscription sub = new Subscription();
        sub.setViewer(viewer); sub.setPlan(plan); sub.setStartDate(now); sub.setEndDate(now.plusDays(plan.getDurationDays()));
        sub.setSubStatus("ACTIVE"); sub.setAutoRenew(false); sub = subscriptions.saveAndFlush(sub);
        Payment payment = new Payment();
        payment.setSubscription(sub); payment.setAmount(BigDecimal.ZERO.setScale(2)); payment.setPaidDatetime(now);
        payment.setPayMethod("DEMO_TEST_VISA_" + testPayment.last4()); payment.setPayStatus("SIMULATED");
        payment.setGatewayRef("TEST-" + java.util.UUID.randomUUID()); payment = payments.saveAndFlush(payment);
        if (viewer instanceof RegisteredViewer registered) registered.setIsPremium(true);
        return new BillingDtos.CheckoutResult(statusFor(userId), paymentView(payment),
                new BillingDtos.SubscriptionView(sub.getId(), planName, now, sub.getEndDate(), sub.getSubStatus()));
    }

    @Transactional
    public BillingDtos.Status cancel(Long userId) {
        Viewer viewer = lockedViewer(userId);
        List<Subscription> current = active(userId);
        if (current.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "No active subscription");
        current.forEach(sub -> { sub.setSubStatus("CANCELLED"); sub.setAutoRenew(false); });
        if (viewer instanceof RegisteredViewer registered) registered.setIsPremium(false);
        return statusFor(userId);
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.AdminUserSubscription> adminUsers() {
        return users.findAll().stream().filter(Viewer.class::isInstance).map(user -> {
            var status = statusFor(user.getId());
            String display = user.getFirstName() == null ? user.getUsername() :
                    (user.getFirstName() + " " + (user.getLastName() == null ? "" : user.getLastName())).trim();
            return new BillingDtos.AdminUserSubscription(user.getId(), user.getUsername(), display,
                    status.planName(), status.status(), status.startDate(), status.endDate());
        }).sorted(Comparator.comparing(BillingDtos.AdminUserSubscription::username)).toList();
    }

    private Viewer requireViewer(Long userId) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        User user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Viewer required"));
        if (!(user instanceof Viewer viewer)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Viewer required");
        if (!"ACTIVE".equals(viewer.getAccountStatus())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return viewer;
    }
    private Viewer lockedViewer(Long userId) { Viewer viewer = requireViewer(userId); entityManager.lock(viewer, LockModeType.PESSIMISTIC_WRITE); return viewer; }
}
