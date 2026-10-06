package org.gp14.skopia.billing;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.gp14.skopia.model.subscription.SubscriptionPlan;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.SubscriptionPlanRepository;
import org.gp14.skopia.repository.SubscriptionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Administrator CRUD. Deletion retires a plan while preserving billing history. */
@Service
public class SubscriptionPlanService {
    private final SubscriptionPlanRepository plans;
    private final SubscriptionRepository subscriptions;
    private final EntityManager entityManager;

    public SubscriptionPlanService(SubscriptionPlanRepository plans, SubscriptionRepository subscriptions,
                                   EntityManager entityManager) {
        this.plans = plans;
        this.subscriptions = subscriptions;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public List<BillingDtos.Plan> list(User actor) {
        requireAdmin(actor);
        return plans.findAll().stream().map(SubscriptionPlanService::view)
                .sorted(Comparator.comparing(BillingDtos.Plan::planName)).toList();
    }

    @Transactional(readOnly = true)
    public BillingDtos.Plan get(User actor, Long id) {
        requireAdmin(actor);
        return view(find(id));
    }

    @Transactional
    public BillingDtos.Plan create(User actor, BillingDtos.PlanRequest request) {
        requireAdmin(actor);
        String name = name(request.planName());
        if (plans.existsByPlanNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Plan name already exists");
        }
        SubscriptionPlan plan = new SubscriptionPlan();
        apply(plan, request, name);
        return view(plans.saveAndFlush(plan));
    }

    @Transactional
    public BillingDtos.Plan update(User actor, Long id, BillingDtos.PlanRequest request) {
        requireAdmin(actor);
        SubscriptionPlan plan = locked(id);
        String name = name(request.planName());
        if (!name.equals(plan.getPlanName())) {
            if (subscriptions.existsByPlanId(id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A used plan cannot be renamed; create a new plan");
            }
            if (plans.existsByPlanNameIgnoreCase(name)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Plan name already exists");
            }
        }
        apply(plan, request, name);
        return view(plans.saveAndFlush(plan));
    }

    @Transactional
    public void delete(User actor, Long id) {
        requireAdmin(actor);
        locked(id).setActive(false);
    }

    private SubscriptionPlan locked(Long id) {
        SubscriptionPlan plan = find(id);
        entityManager.refresh(plan, LockModeType.PESSIMISTIC_WRITE);
        return plan;
    }

    private SubscriptionPlan find(Long id) {
        return plans.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan not found"));
    }

    private String name(String raw) {
        String name = raw.trim().toUpperCase(Locale.ROOT);
        if (!name.matches("[A-Z][A-Z0-9_ -]{0,99}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan name must start with a letter and contain letters, numbers, spaces, underscores or hyphens");
        }
        return name;
    }

    private void apply(SubscriptionPlan plan, BillingDtos.PlanRequest request, String name) {
        plan.setPlanName(name);
        plan.setDurationDays(request.durationDays());
        plan.setPrice(request.price());
        plan.setBenefit(request.benefit() == null ? null : request.benefit().trim());
        plan.setAdFree(request.adFree());
        plan.setActive(request.active());
    }

    static BillingDtos.Plan view(SubscriptionPlan plan) {
        return new BillingDtos.Plan(plan.getId(), plan.getPlanName(), plan.getDurationDays(), plan.getPrice(),
                plan.getBenefit(), SubscriptionBenefits.isAdFree(plan), !Boolean.FALSE.equals(plan.getActive()));
    }

    private void requireAdmin(User actor) {
        if (actor == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!(actor instanceof Administrator) || !"ACTIVE".equals(actor.getAccountStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator required");
        }
    }
}
