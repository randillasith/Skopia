package org.gp14.skopia.billing;

import jakarta.persistence.EntityManager;
import org.gp14.skopia.model.subscription.*;
import org.gp14.skopia.model.user.*;
import org.gp14.skopia.notification.NotificationService;
import org.gp14.skopia.mail.BillingMailService;
import org.gp14.skopia.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class BillingService {
    private final UserRepository users;
    private final SubscriptionRepository subscriptions;
    private final SubscriptionPlanRepository plans;
    private final PaymentRepository payments;
    private final RefundRepository refunds;
    private final RefundStatusHistoryRepository refundHistory;
    private final ActivityLogRepository logs;
    private final NotificationService notificationService;
    private final BillingMailService billingMail;
    private final EntityManager entityManager;
    private final boolean demoEnabled;
    private final int refundWindowDays;

    public BillingService(UserRepository users, SubscriptionRepository subscriptions, SubscriptionPlanRepository plans,
                          PaymentRepository payments, RefundRepository refunds,
                          RefundStatusHistoryRepository refundHistory, ActivityLogRepository logs,
                          NotificationService notificationService, BillingMailService billingMail, EntityManager entityManager,
                          @Value("${skopia.billing.demo-enabled:false}") boolean demoEnabled,
                          @Value("${skopia.billing.refund-window-days:30}") int refundWindowDays) {
        this.users = users;
        this.subscriptions = subscriptions;
        this.plans = plans;
        this.payments = payments;
        this.refunds = refunds;
        this.refundHistory = refundHistory;
        this.logs = logs;
        this.notificationService = notificationService;
        this.billingMail = billingMail;
        this.entityManager = entityManager;
        this.demoEnabled = demoEnabled;
        if (refundWindowDays < 1 || refundWindowDays > 365) {
            throw new IllegalArgumentException("skopia.billing.refund-window-days must be between 1 and 365");
        }
        this.refundWindowDays = refundWindowDays;
    }

    @Transactional(readOnly = true)
    public BillingDtos.Catalog plans() {
        return new BillingDtos.Catalog(demoEnabled, plans.findAll().stream()
                .filter(p -> "MONTHLY".equals(p.getPlanName()))
                .map(p -> new BillingDtos.Plan(p.getId(), p.getPlanName(), 30, new BigDecimal("500.00"),
                        p.getBenefit(), SubscriptionBenefits.isAdFree(p.getPlanName())))
                .sorted(Comparator.comparing(BillingDtos.Plan::durationDays)).toList(), Currency.LKR,
                demoEnabled, false, "Complimentary monthly access: listed price LKR 500, amount due LKR 0, no automatic renewal.",
                "SAMPLE ONLY: no receiving bank account. Do not transfer money. Upload a sample slip for review simulation.");
    }

    @Transactional(readOnly = true)
    public boolean hasActivePremium(Long id) {
        return id != null && users.findById(id).filter(u -> u instanceof Viewer && "ACTIVE".equals(u.getAccountStatus())).isPresent()
                && !active(id).isEmpty();
    }

    /** Re-evaluated for every delivery; legacy profile flags do not grant benefits. */
    @Transactional(readOnly = true)
    public boolean hasAdFreeSubscription(Long id) {
        if (id == null || users.findById(id)
                .filter(u -> u instanceof Viewer && "ACTIVE".equals(u.getAccountStatus())).isEmpty()) return false;
        return active(id).stream().anyMatch(s -> s.getPlan() != null
                && SubscriptionBenefits.isAdFree(s.getPlan().getPlanName()));
    }

    private List<Subscription> active(Long id) {
        LocalDateTime now = LocalDateTime.now();
        return subscriptions.findByViewerIdAndSubStatusAndEndDateAfterOrderByEndDateDesc(id, "ACTIVE", now).stream()
                .filter(s -> !s.getStartDate().isAfter(now)).toList();
    }

    @Transactional(readOnly = true)
    public BillingDtos.Status status(Long id) {
        requireViewer(id);
        return statusFor(id);
    }

    private BillingDtos.Status statusFor(Long id) {
        var cur = active(id).stream().findFirst();
        if (cur.isPresent()) return statusOf(cur.get(), "ACTIVE", true);
        var latest = subscriptions.findByViewerIdOrderByEndDateDescIdDesc(id).stream().findFirst();
        if (latest.isEmpty()) return new BillingDtos.Status(false, null, null, null, null, "FREE", false);
        Subscription s = latest.get();
        String state = "CANCELLED".equalsIgnoreCase(s.getSubStatus()) ? "CANCELLED"
                : !s.getEndDate().isAfter(LocalDateTime.now()) ? "EXPIRED" : s.getSubStatus().toUpperCase(Locale.ROOT);
        return statusOf(s, state, false);
    }

    private BillingDtos.Status statusOf(Subscription s, String state, boolean premium) {
        return new BillingDtos.Status(premium, s.getId(), s.getPlan().getPlanName(), s.getStartDate(), s.getEndDate(),
                state, premium && hasAdFreeSubscription(s.getViewer().getId()));
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.PaymentView> payments(Long id) {
        requireViewer(id);
        return payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(id).stream().map(this::paymentView).toList();
    }

    @Transactional(readOnly = true)
    public BillingDtos.PaymentView payment(Long id, Long paymentId) {
        requireViewer(id);
        return payments.findByIdAndSubscriptionViewerId(paymentId, id).map(this::paymentView)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private BillingDtos.PaymentView paymentView(Payment p) {
        String method = p.getPayMethod();
        String brand = method != null && method.startsWith("DEMO_TEST_VISA_") ? "VISA"
                : method != null && method.startsWith("CARD_PREVIEW_")
                ? method.substring("CARD_PREVIEW_".length())
                : method != null && method.startsWith("DEMO_") ? "DEMO" : null;
        String last4 = method != null && method.startsWith("DEMO_TEST_VISA_")
                ? method.substring("DEMO_TEST_VISA_".length()) : null;
        return new BillingDtos.PaymentView(p.getId(), p.getAmount(), p.getCurrency(), p.getPaidDatetime(), method,
                p.getPayStatus(), p.getSubscription().getPlan().getPlanName(), p.getGatewayRef(), brand, last4);
    }

    @Transactional
    public BillingDtos.Status cancel(Long id) {
        Viewer v = lockedViewer(id);
        List<Subscription> cur = active(id);
        if (cur.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "No active subscription");
        cur.forEach(s -> { s.setSubStatus("CANCELLED"); s.setAutoRenew(false); });
        syncPremium(v, false);
        return statusFor(id);
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.RefundView> userRefunds(Long id) {
        requireViewer(id);
        return refunds.findByPaymentSubscriptionViewerIdOrderByRequestedDateDesc(id).stream().map(this::refundView).toList();
    }

    @Transactional(readOnly = true)
    public BillingDtos.RefundEligibility refundEligibility(Long id, Long paymentId) {
        requireViewer(id);
        Payment payment = payments.findByIdAndSubscriptionViewerId(paymentId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        LocalDateTime eligibleUntil = payment.getPaidDatetime().plusDays(refundWindowDays);
        if (refunds.existsByPaymentId(paymentId))
            return new BillingDtos.RefundEligibility(false, "ALREADY_REQUESTED", refundWindowDays, eligibleUntil);
        if (!isRefundableDemoPayment(payment))
            return new BillingDtos.RefundEligibility(false, "PAYMENT_NOT_REFUNDABLE", refundWindowDays, eligibleUntil);
        if (LocalDateTime.now().isAfter(eligibleUntil))
            return new BillingDtos.RefundEligibility(false, "WINDOW_EXPIRED", refundWindowDays, eligibleUntil);
        return new BillingDtos.RefundEligibility(true, "ELIGIBLE", refundWindowDays, eligibleUntil);
    }

    @Transactional
    public BillingDtos.RefundView requestRefund(Long id, Long paymentId, BillingDtos.RefundRequest request) {
        Viewer owner = requireViewer(id);
        if (request.paymentId() != null && !request.paymentId().equals(paymentId))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "paymentId does not match the request path");
        String why = clean(request.reason(), 255, "Refund reason");
        if (why.length() < 10)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund reason must contain at least 10 characters");
        Payment payment = payments.findLockedByIdAndSubscriptionViewerId(paymentId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (refunds.existsByPaymentId(paymentId))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A refund request has already been submitted for this payment");
        if (!isRefundableDemoPayment(payment))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Only settled simulated payments are refundable");
        LocalDateTime eligibleUntil = payment.getPaidDatetime().plusDays(refundWindowDays);
        if (LocalDateTime.now().isAfter(eligibleUntil))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "The refund eligibility window has expired");

        Refund refund = new Refund();
        refund.setPayment(payment);
        refund.setRefundAmount(payment.getAmount());
        refund.setCurrency(payment.getCurrency());
        refund.setCategory(request.category());
        refund.setReason(why);
        refund.setRefundStatus(RefundStatus.PENDING);
        try {
            refund = refunds.saveAndFlush(refund);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A refund request has already been submitted for this payment", ex);
        }
        addHistory(refund, null, RefundStatus.PENDING, owner, "Refund requested");
        billingMail.refund(refund);
        notificationService.create(owner, "Refund request received",
                "Your simulated refund request is pending review.", "REFUND_REQUESTED",
                "/billing", "REFUND_REQUESTED:" + refund.getId());
        for (User user : users.findAll()) {
            if (user instanceof Administrator && "ACTIVE".equals(user.getAccountStatus())) {
                notificationService.create(user, "New refund request",
                        owner.getUsername() + " submitted a simulated refund request.", "REFUND_ADMIN_NEW",
                        "/admin/refunds", "REFUND_ADMIN_NEW:" + refund.getId());
            }
        }
        return refundView(refund);
    }

    @Transactional
    public BillingDtos.RefundView cancelRefund(Long id, Long refundId) {
        Viewer owner = requireViewer(id);
        Refund refund = refunds.findLockedById(refundId)
                .filter(r -> r.getPayment().getSubscription().getViewer().getId().equals(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (refund.getRefundStatus() != RefundStatus.PENDING)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only pending refund requests can be cancelled");
        refund.setRefundStatus(RefundStatus.CANCELLED);
        refund.setProcessedDate(LocalDateTime.now());
        refund.setDecisionNote("Cancelled by requester");
        addHistory(refund, RefundStatus.PENDING, RefundStatus.CANCELLED, owner, refund.getDecisionNote());
        billingMail.refund(refund);
        notificationService.create(owner, "Refund request cancelled",
                "Your simulated refund request was cancelled.", "REFUND_CANCELLED",
                "/billing", "REFUND_CANCELLED:" + refund.getId());
        for (User user : users.findAll()) {
            if (user instanceof Administrator && "ACTIVE".equals(user.getAccountStatus())) {
                notificationService.create(user, "Refund request withdrawn",
                        owner.getUsername() + " cancelled a pending simulated refund request.",
                        "REFUND_ADMIN_CANCELLED", "/admin/refunds",
                        "REFUND_ADMIN_CANCELLED:" + refund.getId());
            }
        }
        refunds.saveAndFlush(refund);
        return refundView(refund);
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.RefundHistoryView> refundHistory(User actor, Long refundId) {
        Refund refund = refunds.findById(refundId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean owner = actor != null && refund.getPayment().getSubscription().getViewer().getId().equals(actor.getId());
        if (!(actor instanceof Administrator) && !owner)
            throw new ResponseStatusException(actor == null ? HttpStatus.UNAUTHORIZED : HttpStatus.NOT_FOUND);
        return refundHistory.findByRefundIdOrderByChangedAtAscIdAsc(refundId).stream().map(this::historyView).toList();
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.RefundView> adminRefundsLegacy() {
        return refunds.findAllByOrderByRequestedDateDesc().stream().map(this::refundView).toList();
    }

    @Transactional(readOnly = true)
    public Page<BillingDtos.RefundView> adminRefunds(RefundStatus status, RefundCategory category, String query,
                                                     LocalDate requestedFrom, LocalDate requestedTo,
                                                     Pageable pageable) {
        validateDateRange(requestedFrom, requestedTo);
        return refunds.findAll(refundSpec(status, category, query, requestedFrom, requestedTo), pageable)
                .map(this::refundView);
    }

    @Transactional(readOnly = true)
    public long pendingRefundCount() {
        return refunds.countByRefundStatus(RefundStatus.PENDING);
    }

    @Transactional
    public BillingDtos.RefundView decideRefund(User actor, Long refundId, RefundStatus decision, String note) {
        if (!(actor instanceof Administrator admin))
            throw new ResponseStatusException(actor == null ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN);
        if (decision != RefundStatus.APPROVED && decision != RefundStatus.REJECTED)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decision must be APPROVED or REJECTED");
        Refund refund = refunds.findLockedById(refundId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (refund.getRefundStatus() != RefundStatus.PENDING)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Refund request is already final");
        String decisionNote = note == null || note.isBlank() ? null : clean(note, 500, "Decision note");
        if (decision == RefundStatus.REJECTED && decisionNote == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A rejection note is required");

        refund.setRefundStatus(decision);
        refund.setProcessedBy(admin);
        refund.setProcessedDate(LocalDateTime.now());
        refund.setDecisionNote(decisionNote);
        User target = refund.getPayment().getSubscription().getViewer();
        if (decision == RefundStatus.APPROVED) {
            Subscription subscription = refund.getPayment().getSubscription();
            subscription.setSubStatus("CANCELLED");
            subscription.setAutoRenew(false);
            syncPremium((Viewer) target, active(target.getId()).stream()
                    .anyMatch(other -> !other.getId().equals(subscription.getId())));
        }
        addHistory(refund, RefundStatus.PENDING, decision, admin, decisionNote);
        billingMail.refund(refund);
        ActivityLog log = new ActivityLog();
        log.setUser(actor); log.setActor(actor); log.setTargetUser(target);
        log.setActionType("SIMULATED_REFUND_" + decision.name());
        log.setDetail("refund=" + refund.getId() + " " + decision.name() + ", payment=" + refund.getPayment().getId());
        log.setIpAddress("127.0.0.1");
        logs.save(log);
        notificationService.create(target,
                decision == RefundStatus.APPROVED ? "Refund request approved" : "Refund request rejected",
                decision == RefundStatus.APPROVED
                        ? "Your simulated refund request was approved and the related entitlement was revoked."
                        : "Your simulated refund request was rejected. Note: " + decisionNote,
                "REFUND_" + decision.name(), "/billing",
                "REFUND_" + decision.name() + ":" + refund.getId());
        refunds.saveAndFlush(refund);
        return refundView(refund);
    }

    @Transactional(readOnly = true)
    public String exportRefundsCsv(RefundStatus status, RefundCategory category, String query,
                                   LocalDate requestedFrom, LocalDate requestedTo) {
        validateDateRange(requestedFrom, requestedTo);
        StringBuilder csv = new StringBuilder("refundId,status,category,amount,currency,requestedAt,username,email,paymentId,planName,reason,note\r\n");
        for (Refund refund : refunds.findAll(refundSpec(status, category, query, requestedFrom, requestedTo),
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "requestedDate"))) {
            User owner = refund.getPayment().getSubscription().getViewer();
            csv.append(csv(refund.getId())).append(',').append(csv(refund.getRefundStatus())).append(',')
                    .append(csv(refund.getCategory())).append(',').append(csv(refund.getRefundAmount())).append(',')
                    .append(csv(refund.getCurrency())).append(',').append(csv(refund.getRequestedDate())).append(',')
                    .append(csv(owner.getUsername())).append(',').append(csv(owner.getEmail())).append(',')
                    .append(csv(refund.getPayment().getId())).append(',')
                    .append(csv(refund.getPayment().getSubscription().getPlan().getPlanName())).append(',')
                    .append(csv(refund.getReason())).append(',').append(csv(refund.getDecisionNote())).append("\r\n");
        }
        return csv.toString();
    }

    private Specification<Refund> refundSpec(RefundStatus status, RefundCategory category, String query,
                                              LocalDate requestedFrom, LocalDate requestedTo) {
        return (root, cq, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (status != null) predicates.add(cb.equal(root.get("refundStatus"), status));
            if (category != null) predicates.add(cb.equal(root.get("category"), category));
            if (requestedFrom != null)
                predicates.add(cb.greaterThanOrEqualTo(root.get("requestedDate"), requestedFrom.atStartOfDay()));
            if (requestedTo != null)
                predicates.add(cb.lessThan(root.get("requestedDate"), requestedTo.plusDays(1).atStartOfDay()));
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.trim().toLowerCase(Locale.ROOT) + "%";
                var subscription = root.get("payment").get("subscription");
                var viewer = subscription.get("viewer");
                var matches = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
                matches.add(cb.like(cb.lower(root.get("reason")), pattern));
                matches.add(cb.like(cb.lower(viewer.get("username")), pattern));
                matches.add(cb.like(cb.lower(viewer.get("email")), pattern));
                matches.add(cb.like(cb.lower(subscription.get("plan").get("planName")), pattern));
                try {
                    Long numeric = Long.valueOf(query.trim());
                    matches.add(cb.equal(root.get("id"), numeric));
                    matches.add(cb.equal(root.get("payment").get("id"), numeric));
                } catch (NumberFormatException ignored) {
                    // Text search only.
                }
                predicates.add(cb.or(matches.toArray(jakarta.persistence.criteria.Predicate[]::new)));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private void validateDateRange(LocalDate requestedFrom, LocalDate requestedTo) {
        if (requestedFrom != null && requestedTo != null && requestedFrom.isAfter(requestedTo))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "requestedFrom must not be after requestedTo");
    }

    private void addHistory(Refund refund, RefundStatus from, RefundStatus to, User actor, String note) {
        RefundStatusHistory history = new RefundStatusHistory();
        history.setRefund(refund); history.setFromStatus(from); history.setToStatus(to);
        history.setChangedBy(actor); history.setChangeNote(note);
        refundHistory.save(history);
    }

    private BillingDtos.RefundHistoryView historyView(RefundStatusHistory history) {
        User actor = history.getChangedBy();
        return new BillingDtos.RefundHistoryView(history.getId(), history.getFromStatus(), history.getToStatus(),
                actor == null ? null : actor.getId(), actor == null ? null : actor.getUsername(),
                history.getChangeNote(), history.getChangedAt());
    }

    private BillingDtos.RefundView refundView(Refund refund) {
        var processor = refund.getProcessedBy();
        User owner = refund.getPayment().getSubscription().getViewer();
        return new BillingDtos.RefundView(refund.getId(), refund.getPayment().getId(),
                refund.getPayment().getSubscription().getId(), refund.getPayment().getSubscription().getPlan().getPlanName(),
                refund.getRefundAmount(), refund.getCurrency(), refund.getCategory(), refund.getReason(),
                refund.getRefundStatus(), "SIMULATED".equals(refund.getPayment().getPayStatus()), refund.getRequestedDate(),
                processor == null ? null : processor.getId(), processor == null ? null : processor.getUsername(),
                processor == null ? null : processor.getEmail(), refund.getProcessedDate(), refund.getDecisionNote(),
                owner.getUsername(), owner.getEmail(),
                refund.getPayment().getPaidDatetime().plusDays(refundWindowDays), refund.getVersion());
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.AdminUserSubscription> adminUsers() {
        return users.findAll().stream().filter(Viewer.class::isInstance).map(user -> {
            var status = statusFor(user.getId());
            var latestPayment = payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(user.getId()).stream()
                    .findFirst().orElse(null);
            var latestRefund = refunds.findByPaymentSubscriptionViewerIdOrderByRequestedDateDesc(user.getId()).stream()
                    .findFirst().orElse(null);
            String display = user.getFirstName() == null ? user.getUsername()
                    : (user.getFirstName() + " " + (user.getLastName() == null ? "" : user.getLastName())).trim();
            return new BillingDtos.AdminUserSubscription(user.getId(), user.getUsername(), display, user.getEmail(),
                    status.subscriptionId(), status.planName(), status.status(), status.startDate(), status.endDate(),
                    latestPayment == null ? null : paymentView(latestPayment),
                    latestRefund == null ? null : refundView(latestRefund));
        }).sorted(Comparator.comparing(BillingDtos.AdminUserSubscription::username)).toList();
    }

    private Viewer requireViewer(Long id) {
        if (id == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        User user = users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Viewer required"));
        if (!(user instanceof Viewer viewer))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Viewer required");
        if (!"ACTIVE".equals(viewer.getAccountStatus())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return viewer;
    }

    private Viewer lockedViewer(Long id) {
        Viewer viewer = requireViewer(id);
        entityManager.lock(viewer, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        return viewer;
    }

    private void syncPremium(Viewer viewer, boolean value) {
        if (viewer instanceof RegisteredViewer registeredViewer) registeredViewer.setIsPremium(value);
    }

    private void enabled() {
        if (!demoEnabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Demo billing disabled");
    }

    private void validatePlan(String plan) {
        if (!List.of("MONTHLY", "YEARLY").contains(plan))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported plan");
    }

    private boolean isRefundableDemoPayment(Payment payment) {
        if (payment == null || !"SIMULATED".equals(payment.getPayStatus())) return false;
        String method = payment.getPayMethod();
        return method != null && (method.startsWith("DEMO_TEST_VISA_") || "DEMO_PLAN_CHANGE".equals(method)
                || method.startsWith("CARD_PREVIEW_") || "BANK_TRANSFER_PREVIEW".equals(method));
    }

    private String clean(String value, int max, String field) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > max)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " must contain 1 to " + max + " characters");
        return value.trim();
    }

    private String csv(Object value) {
        String text = value == null ? "" : String.valueOf(value);
        if (!text.isEmpty() && ("=+-@\t\r".indexOf(text.charAt(0)) >= 0)) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
}
