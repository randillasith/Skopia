package org.gp14.skopia.billing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.gp14.skopia.model.subscription.Currency;
import org.gp14.skopia.model.subscription.RefundCategory;
import org.gp14.skopia.model.subscription.RefundStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Public billing contract; never serialize JPA entities or payment credentials. */
public final class BillingDtos {
    private BillingDtos() {}

    public record Plan(Long id, String planName, int durationDays, BigDecimal price, String benefit, boolean adFree) {}
    public record Catalog(boolean demoEnabled, List<Plan> plans) {}
    public record Status(boolean premium, Long subscriptionId, String planName, LocalDateTime startDate,
                         LocalDateTime endDate, String status, boolean adFree) {}
    public record PaymentView(Long id, BigDecimal amount, Currency currency, LocalDateTime paidDatetime,
                              String payMethod, String payStatus, String planName, String reference,
                              String cardBrand, String cardLast4) {}
    public record SubscriptionView(Long id, String planName, LocalDateTime startDate, LocalDateTime endDate, String status) {}
    public record CheckoutResult(Status status, PaymentView payment, SubscriptionView subscription) {}

    public record RefundRequest(Long paymentId, @NotNull RefundCategory category,
                                @NotBlank @Size(min = 10, max = 255) String reason) {}
    public record RefundDecision(@NotNull RefundStatus decision, @Size(max = 500) String note) {}
    public record RefundEligibility(boolean eligible, String reason, int windowDays, LocalDateTime eligibleUntil) {}
    public record PendingCount(long count) {}
    public record RefundPage(List<RefundView> content, long totalElements, int totalPages, int page, int size,
                             boolean hasNext) {}
    public record RefundHistoryView(Long id, RefundStatus fromStatus, RefundStatus toStatus,
                                    Long changedById, String changedByUsername, String note,
                                    LocalDateTime changedAt) {}
    public record RefundView(Long id, Long paymentId, Long subscriptionId, String planName, BigDecimal amount,
                             Currency currency, RefundCategory category, String reason, RefundStatus status,
                             boolean simulation, LocalDateTime requestedAt, Long processedById,
                             String processedByUsername, String processedByEmail, LocalDateTime decidedAt,
                             String processingNote, String username, String email, LocalDateTime eligibleUntil,
                             long version) {}
    public record AdminUserSubscription(Long userId, String username, String displayName, String email,
                                        Long subscriptionId, String planName, String status,
                                        LocalDateTime startDate, LocalDateTime endDate,
                                        PaymentView payment, RefundView refund) {}
}
