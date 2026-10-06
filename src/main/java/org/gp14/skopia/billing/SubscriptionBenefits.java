package org.gp14.skopia.billing;

/** Current pass benefits. Unrecognised plans remain ad-supported by default. */
public final class SubscriptionBenefits {
    private SubscriptionBenefits() {}

    public static boolean isAdFree(String planName) {
        return "MONTHLY".equals(planName) || "YEARLY".equals(planName);
    }

    public static boolean isAdFree(org.gp14.skopia.model.subscription.SubscriptionPlan plan) {
        return plan.getAdFree() == null ? isAdFree(plan.getPlanName()) : plan.getAdFree();
    }
}
