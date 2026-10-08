package org.gp14.skopia.billing;

import org.gp14.skopia.model.subscription.SubscriptionPlan;
import org.gp14.skopia.repository.SubscriptionPlanRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;

@Configuration
class DemoPlanCatalog {
    @Bean
    ApplicationRunner seedDemoPlans(SubscriptionPlanRepository plans, TransactionTemplate transactions,
                                     @Value("${skopia.billing.demo-enabled:false}") boolean enabled) {
        return args -> {
            if (!enabled) return;
            transactions.executeWithoutResult(tx -> {
                seed(plans, "MONTHLY", 30);
            });
        };
    }

    private void seed(SubscriptionPlanRepository plans, String name, int days) {
        var existing = plans.findByPlanName(name);
        if (existing.isPresent()) {
            SubscriptionPlan plan = existing.get();
            plan.setPrice(new BigDecimal("500.00"));
            plan.setDurationDays(30);
            plan.setBenefit("Test-only preview; one-time 30-day access, no charge and no automatic renewal");
            plans.save(plan);
            return;
        }
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPlanName(name); plan.setDurationDays(days);
        plan.setPrice(new BigDecimal("500.00"));
        plan.setBenefit("Test-only preview; one-time 30-day access, no charge and no automatic renewal");
        plans.save(plan);
    }
}
