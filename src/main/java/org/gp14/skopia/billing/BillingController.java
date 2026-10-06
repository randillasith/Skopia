package org.gp14.skopia.billing;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.gp14.skopia.model.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController @RequestMapping("/api/billing")
public class BillingController {
    private final BillingService billing; public BillingController(BillingService billing){this.billing=billing;}
    @GetMapping("/plans") public BillingDtos.Catalog plans(){return billing.plans();}
    @GetMapping("/status") public BillingDtos.Status status(@AuthenticationPrincipal User u){return billing.status(id(u));}
    @GetMapping("/payments") public List<BillingDtos.PaymentView> payments(@AuthenticationPrincipal User u){return billing.payments(id(u));}
    @GetMapping("/payments/{paymentId}") public BillingDtos.PaymentView payment(@AuthenticationPrincipal User u,@PathVariable Long paymentId){return billing.payment(id(u),paymentId);}
    @PostMapping({"/checkout", "/subscriptions"}) @ResponseStatus(HttpStatus.CREATED) public BillingDtos.CheckoutResult checkout(@AuthenticationPrincipal User u,@RequestBody JsonNode r){var fields=java.util.Set.of("planName","cardNumber","expiry","cardholderName");if(!r.isObject()||r.size()!=fields.size()||!fields.stream().allMatch(n->r.has(n)&&r.get(n).isTextual()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid demo payment fields");return billing.checkout(id(u),r.get("planName").asText(),r.get("cardNumber").asText(),r.get("expiry").asText(),r.get("cardholderName").asText());}
    @PostMapping("/change-plan") @ResponseStatus(HttpStatus.CREATED) public BillingDtos.CheckoutResult change(@AuthenticationPrincipal User u,@RequestBody JsonNode r){if(!r.isObject()||r.size()!=1||!r.has("planName")||!r.get("planName").isTextual())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"planName is required");return billing.changePlan(id(u),r.get("planName").asText());}
    @PostMapping("/cancel") public BillingDtos.Status cancel(@AuthenticationPrincipal User u){return billing.cancel(id(u));}
    @GetMapping("/refunds") public List<BillingDtos.RefundView> refunds(@AuthenticationPrincipal User u){return billing.userRefunds(id(u));}
    @PostMapping("/refunds") @ResponseStatus(HttpStatus.CREATED) public BillingDtos.RefundView request(@AuthenticationPrincipal User u,@RequestBody JsonNode r){return billing.requestRefund(id(u),r.path("paymentId").asLong(),r.path("reason").asText(null));}
    @PostMapping("/payments/{paymentId}/refunds") @ResponseStatus(HttpStatus.CREATED) public BillingDtos.RefundView request(@AuthenticationPrincipal User u,@PathVariable Long paymentId,@RequestBody JsonNode r){return billing.requestRefund(id(u),paymentId,r.path("reason").asText(null));}
    @GetMapping("/admin/users") public List<BillingDtos.AdminUserSubscription> adminUsers(){return billing.adminUsers();}
    @GetMapping("/admin/refunds") public List<BillingDtos.RefundView> adminRefunds(){return billing.adminRefunds();}
    @PostMapping("/admin/refunds/{refundId}/decision") public BillingDtos.RefundView decide(@AuthenticationPrincipal User u,@PathVariable Long refundId,@RequestBody JsonNode r){return billing.decideRefund(u,refundId,r.path("decision").asText(null),r.path("note").asText(null));}
    @PostMapping("/admin/refunds/{refundId}/approve") public BillingDtos.RefundView approve(@AuthenticationPrincipal User u,@PathVariable Long refundId,@RequestBody(required=false) JsonNode r){return billing.decideRefund(u,refundId,"APPROVED",r==null?null:r.path("note").asText(null));}
    @PostMapping("/admin/refunds/{refundId}/reject") public BillingDtos.RefundView reject(@AuthenticationPrincipal User u,@PathVariable Long refundId,@RequestBody(required=false) JsonNode r){return billing.decideRefund(u,refundId,"REJECTED",r==null?null:r.path("note").asText(null));}

    @GetMapping("/subscriptions")
    public List<BillingDtos.SubscriptionView> subscriptions(@AuthenticationPrincipal User user) {
        return billing.subscriptions(id(user));
    }

    @GetMapping("/subscriptions/{subscriptionId}")
    public BillingDtos.SubscriptionView subscription(@AuthenticationPrincipal User user, @PathVariable Long subscriptionId) {
        return billing.subscription(id(user), subscriptionId);
    }

    @PutMapping("/subscriptions/{subscriptionId}")
    public BillingDtos.CheckoutResult updateSubscription(@AuthenticationPrincipal User user, @PathVariable Long subscriptionId,
                                                        @Valid @RequestBody BillingDtos.PlanChange request) {
        return billing.updateSubscription(id(user), subscriptionId, request.planName());
    }

    @DeleteMapping("/subscriptions/{subscriptionId}")
    public BillingDtos.SubscriptionView cancelSubscription(@AuthenticationPrincipal User user, @PathVariable Long subscriptionId) {
        return billing.cancelSubscription(id(user), subscriptionId);
    }

    @PostMapping("/subscriptions/{subscriptionId}/renew")
    @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.CheckoutResult renew(@AuthenticationPrincipal User user, @PathVariable Long subscriptionId,
                                           @Valid @RequestBody BillingDtos.DemoPaymentRequest request) {
        return billing.renew(id(user), subscriptionId, request);
    }

    @GetMapping("/payments/{paymentId}/receipt")
    public BillingDtos.Receipt receipt(@AuthenticationPrincipal User user, @PathVariable Long paymentId) {
        return billing.receipt(id(user), paymentId);
    }

    @GetMapping(value = "/payments/{paymentId}/receipt/download", produces = "text/plain;charset=UTF-8")
    public org.springframework.http.ResponseEntity<String> downloadReceipt(@AuthenticationPrincipal User user, @PathVariable Long paymentId) {
        BillingDtos.Receipt receipt = billing.receipt(id(user), paymentId);
        BillingDtos.PaymentView payment = receipt.payment();
        String text = String.format(java.util.Locale.ROOT,
                "Skopia payment receipt%nReceipt: %s%nAccount: %s%nPlan: %s%nPaid at: %s%nAmount: %s%nStatus: %s%nReference: %s%nPeriod: %s to %s%n%s%n",
                receipt.receiptNumber(), receipt.username(), payment.planName(), payment.paidDatetime(), payment.amount(),
                payment.payStatus(), payment.reference(), receipt.periodStart(), receipt.periodEnd(),
                receipt.simulated() ? "DEMO ONLY - no money was charged." : "");
        return org.springframework.http.ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + receipt.receiptNumber() + ".txt\"")
                .header("Cache-Control", "no-store")
                .body(text);
    }

    @GetMapping("/refunds/{refundId}")
    public BillingDtos.RefundView refund(@AuthenticationPrincipal User user, @PathVariable Long refundId) {
        return billing.refund(id(user), refundId);
    }

    @PutMapping("/refunds/{refundId}")
    public BillingDtos.RefundView updateRefund(@AuthenticationPrincipal User user, @PathVariable Long refundId,
                                             @Valid @RequestBody BillingDtos.RefundReason request) {
        return billing.updateRefund(id(user), refundId, request.reason());
    }

    @DeleteMapping("/refunds/{refundId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelRefund(@AuthenticationPrincipal User user, @PathVariable Long refundId) {
        billing.cancelRefund(id(user), refundId);
    }

    private Long id(User u){if(u==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);return u.getId();}
}
