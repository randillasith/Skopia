package org.gp14.skopia.billing;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Public billing contract; never serialize JPA entities or payment credentials. */
public final class BillingDtos {
    private BillingDtos() {}
    public record Plan(Long id,String planName,int durationDays,BigDecimal price,String benefit,boolean adFree) {}
    public record Catalog(boolean demoEnabled,List<Plan> plans) {}
    public record Status(boolean premium,Long subscriptionId,String planName,LocalDateTime startDate,LocalDateTime endDate,String status,boolean adFree) {}
    public record PaymentView(Long id,BigDecimal amount,LocalDateTime paidDatetime,String payMethod,String payStatus,String planName,String reference,String cardBrand,String cardLast4) {}
    public record SubscriptionView(Long id,String planName,LocalDateTime startDate,LocalDateTime endDate,String status) {}
    public record CheckoutResult(Status status,PaymentView payment,SubscriptionView subscription) {}
    public record RefundView(Long id,Long paymentId,Long subscriptionId,String planName,BigDecimal amount,String reason,String status,
            LocalDateTime requestedAt,Long processedById,String processedByUsername,String processedByEmail,LocalDateTime decidedAt,
            String processingNote,String username,String email) {}
    public record AdminUserSubscription(Long userId,String username,String displayName,String email,Long subscriptionId,String planName,
            String status,LocalDateTime startDate,LocalDateTime endDate,PaymentView payment,RefundView refund) {}
}
