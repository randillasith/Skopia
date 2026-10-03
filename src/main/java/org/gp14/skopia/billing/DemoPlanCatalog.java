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
                seed(plans, "YEARLY", 365);
            });
        };
    }

    private void seed(SubscriptionPlanRepository plans, String name, int days) {
        if (plans.findByPlanName(name).isPresent()) return;
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPlanName(name); plan.setDurationDays(days);
        plan.setPrice(BigDecimal.ZERO.setScale(2));
        plan.setBenefit("Simulated premium access only; no charge or automatic renewal");
        plans.save(plan);
    }
}
