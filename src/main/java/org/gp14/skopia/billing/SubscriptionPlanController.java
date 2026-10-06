package org.gp14.skopia.billing;

import jakarta.validation.Valid;
import org.gp14.skopia.model.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/billing/admin/plans")
public class SubscriptionPlanController {
    private final SubscriptionPlanService plans;

    public SubscriptionPlanController(SubscriptionPlanService plans) { this.plans = plans; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.Plan create(@AuthenticationPrincipal User actor, @Valid @RequestBody BillingDtos.PlanRequest request) {
        return plans.create(actor, request);
    }

    @GetMapping
    public List<BillingDtos.Plan> list(@AuthenticationPrincipal User actor) { return plans.list(actor); }

    @GetMapping("/{id}")
    public BillingDtos.Plan get(@AuthenticationPrincipal User actor, @PathVariable Long id) { return plans.get(actor, id); }

    @PutMapping("/{id}")
    public BillingDtos.Plan update(@AuthenticationPrincipal User actor, @PathVariable Long id,
                                   @Valid @RequestBody BillingDtos.PlanRequest request) {
        return plans.update(actor, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal User actor, @PathVariable Long id) { plans.delete(actor, id); }
}
