package org.gp14.skopia.billing;

import com.fasterxml.jackson.databind.JsonNode;
import org.gp14.skopia.model.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/billing")
public class BillingController {
    private final BillingService billing;
    public BillingController(BillingService billing) { this.billing = billing; }


    @GetMapping("/plans")
    public BillingDtos.Catalog plans() { return billing.plans(); }

    @GetMapping("/status")
    public BillingDtos.Status status(@AuthenticationPrincipal User user) { return billing.status(id(user)); }

    @GetMapping("/payments")
    public List<BillingDtos.PaymentView> payments(@AuthenticationPrincipal User user) {
        return billing.payments(id(user));
    }

    @GetMapping("/payments/{id}")
    public BillingDtos.PaymentView payment(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return billing.payment(id(user), id);
    }

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.CheckoutResult checkout(@AuthenticationPrincipal User user, @RequestBody JsonNode request) {
        Long actor = id(user);
        // No payment credentials, prices or client-provided owner IDs can enter this API.
        if (!request.isObject() || request.size() != 1 || !request.has("planName")
                || !request.get("planName").isTextual())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only planName is accepted");
        return billing.checkout(actor, request.get("planName").asText());
    }

    @PostMapping("/cancel")
    public BillingDtos.Status cancel(@AuthenticationPrincipal User user) { return billing.cancel(id(user)); }

    private Long id(User user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return user.getId();
    }
}
