package org.gp14.skopia.video;

import org.gp14.skopia.billing.BillingService;

final class PremiumVideoPlaybackStrategy implements VideoPlaybackStrategy {
    private final BillingService billing;

    PremiumVideoPlaybackStrategy(BillingService billing) {
        this.billing = billing;
    }

    @Override
    public boolean canPlay(Long userId) {
        // BillingService verifies a current subscription and account status.
        return userId != null && billing.hasActivePremium(userId);
    }
}
