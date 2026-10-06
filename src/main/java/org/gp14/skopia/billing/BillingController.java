package org.gp14.skopia.billing;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.gp14.skopia.model.subscription.RefundCategory;
import org.gp14.skopia.model.subscription.RefundStatus;
import org.gp14.skopia.model.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/billing")
public class BillingController {
    private final BillingService billing;

    public BillingController(BillingService billing) {
        this.billing = billing;
    }

    @GetMapping("/plans")
    public BillingDtos.Catalog plans() { return billing.plans(); }

    @GetMapping("/status")
    public BillingDtos.Status status(@AuthenticationPrincipal User user) { return billing.status(id(user)); }

    @GetMapping("/payments")
    public List<BillingDtos.PaymentView> payments(@AuthenticationPrincipal User user) { return billing.payments(id(user)); }

    @GetMapping("/payments/{paymentId}")
    public BillingDtos.PaymentView payment(@AuthenticationPrincipal User user, @PathVariable Long paymentId) {
        return billing.payment(id(user), paymentId);
    }

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.CheckoutResult checkout(@AuthenticationPrincipal User user, @RequestBody JsonNode request) {
        var fields = java.util.Set.of("planName", "cardNumber", "expiry", "cardholderName");
        if (!request.isObject() || request.size() != fields.size()
                || !fields.stream().allMatch(name -> request.has(name) && request.get(name).isTextual()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid demo payment fields");
        return billing.checkout(id(user), request.get("planName").asText(), request.get("cardNumber").asText(),
                request.get("expiry").asText(), request.get("cardholderName").asText());
    }

    @PostMapping("/change-plan")
    @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.CheckoutResult change(@AuthenticationPrincipal User user, @RequestBody JsonNode request) {
        if (!request.isObject() || request.size() != 1 || !request.has("planName") || !request.get("planName").isTextual())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "planName is required");
        return billing.changePlan(id(user), request.get("planName").asText());
    }

    @PostMapping("/cancel")
    public BillingDtos.Status cancel(@AuthenticationPrincipal User user) { return billing.cancel(id(user)); }

    @GetMapping("/payments/{paymentId}/refund-eligibility")
    public BillingDtos.RefundEligibility eligibility(@AuthenticationPrincipal User user, @PathVariable Long paymentId) {
        return billing.refundEligibility(id(user), paymentId);
    }

    @GetMapping("/refunds")
    public List<BillingDtos.RefundView> refunds(@AuthenticationPrincipal User user) {
        return billing.userRefunds(id(user));
    }

    /** Compatibility route retained for clients that put paymentId in the request body. */
    @PostMapping("/refunds")
    @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.RefundView request(@AuthenticationPrincipal User user,
                                           @Valid @RequestBody BillingDtos.RefundRequest request) {
        if (request.paymentId() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "paymentId is required");
        return billing.requestRefund(id(user), request.paymentId(), request);
    }

    @PostMapping("/payments/{paymentId}/refunds")
    @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.RefundView request(@AuthenticationPrincipal User user, @PathVariable Long paymentId,
                                           @Valid @RequestBody BillingDtos.RefundRequest request) {
        return billing.requestRefund(id(user), paymentId, request);
    }

    @PostMapping("/refunds/{refundId}/cancel")
    public BillingDtos.RefundView cancelRefund(@AuthenticationPrincipal User user, @PathVariable Long refundId) {
        return billing.cancelRefund(id(user), refundId);
    }

    @GetMapping("/refunds/{refundId}/history")
    public List<BillingDtos.RefundHistoryView> history(@AuthenticationPrincipal User user, @PathVariable Long refundId) {
        return billing.refundHistory(user, refundId);
    }

    @GetMapping("/admin/users")
    public List<BillingDtos.AdminUserSubscription> adminUsers() { return billing.adminUsers(); }

    @GetMapping("/admin/refunds")
    public Object adminRefunds(@RequestParam(required = false) RefundStatus status,
                               @RequestParam(required = false) RefundCategory category,
                               @RequestParam(name = "q", required = false) String query,
                               @RequestParam(required = false) LocalDate requestedFrom,
                               @RequestParam(required = false) LocalDate requestedTo,
                               @RequestParam(required = false) Integer page,
                               @RequestParam(required = false) Integer size) {
        boolean legacy = status == null && category == null && (query == null || query.isBlank())
                && requestedFrom == null && requestedTo == null && page == null && size == null;
        if (legacy) return billing.adminRefundsLegacy();
        int pageNumber = page == null ? 0 : page;
        int pageSize = size == null ? 25 : size;
        if (pageNumber < 0 || pageSize < 1 || pageSize > 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be non-negative and size must be 1 to 100");
        Page<BillingDtos.RefundView> result = billing.adminRefunds(status, category, query, requestedFrom, requestedTo,
                PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, "requestedDate")));
        return new BillingDtos.RefundPage(result.getContent(), result.getTotalElements(), result.getTotalPages(),
                result.getNumber(), result.getSize(), result.hasNext());
    }

    @GetMapping("/admin/refunds/pending-count")
    public BillingDtos.PendingCount pendingCount() { return new BillingDtos.PendingCount(billing.pendingRefundCount()); }

    @GetMapping(value = "/admin/refunds/export.csv", produces = "text/csv")
    public ResponseEntity<String> export(@RequestParam(required = false) RefundStatus status,
                                         @RequestParam(required = false) RefundCategory category,
                                         @RequestParam(name = "q", required = false) String query,
                                         @RequestParam(required = false) LocalDate requestedFrom,
                                         @RequestParam(required = false) LocalDate requestedTo) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=refunds.csv")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(billing.exportRefundsCsv(status, category, query, requestedFrom, requestedTo));
    }

    @PostMapping("/admin/refunds/{refundId}/decision")
    public BillingDtos.RefundView decide(@AuthenticationPrincipal User user, @PathVariable Long refundId,
                                          @Valid @RequestBody BillingDtos.RefundDecision request) {
        return billing.decideRefund(user, refundId, request.decision(), request.note());
    }

    @PostMapping("/admin/refunds/{refundId}/approve")
    public BillingDtos.RefundView approve(@AuthenticationPrincipal User user, @PathVariable Long refundId,
                                           @RequestBody(required = false) JsonNode request) {
        return billing.decideRefund(user, refundId, RefundStatus.APPROVED,
                request == null ? null : request.path("note").asText(null));
    }

    @PostMapping("/admin/refunds/{refundId}/reject")
    public BillingDtos.RefundView reject(@AuthenticationPrincipal User user, @PathVariable Long refundId,
                                          @RequestBody(required = false) JsonNode request) {
        return billing.decideRefund(user, refundId, RefundStatus.REJECTED,
                request == null ? null : request.path("note").asText(null));
    }

    private Long id(User user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return user.getId();
    }
}
