package org.gp14.skopia.billing;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Public billing contract; never serialize JPA entities or payment credentials. */
public final class BillingDtos {
    private BillingDtos() {}
    public record Plan(Long id, String planName, int durationDays, BigDecimal price, String benefit) {}
    public record Catalog(boolean demoEnabled, List<Plan> plans) {}
    public record Status(boolean premium, String planName, LocalDateTime startDate, LocalDateTime endDate, String status) {}
    public record PaymentView(Long id, BigDecimal amount, LocalDateTime paidDatetime,
                              String payMethod, String payStatus, String planName) {}
    public record SubscriptionView(Long id, String planName, LocalDateTime startDate,
                                   LocalDateTime endDate, String status) {}
    public record CheckoutResult(Status status, PaymentView payment, SubscriptionView subscription) {}
    public record AdminUserSubscription(Long userId, String username, String displayName, String planName,
                                        String status, LocalDateTime startDate, LocalDateTime endDate) {}
}
