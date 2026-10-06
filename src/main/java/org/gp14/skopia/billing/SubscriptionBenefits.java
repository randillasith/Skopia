package org.gp14.skopia.billing;

/** Current pass benefits. Unrecognised plans remain ad-supported by default. */
public final class SubscriptionBenefits {
    private SubscriptionBenefits() {}

    public static boolean isAdFree(String planName) {
        return "MONTHLY".equals(planName) || "YEARLY".equals(planName);
    }
}
