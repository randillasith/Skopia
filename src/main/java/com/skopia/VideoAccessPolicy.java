package com.skopia;

import java.util.Map;

/** Selects the access algorithm for a video's FREE or PREMIUM access type. */
final class VideoAccessPolicy {
    enum Decision { ALLOWED, HIDDEN, PREMIUM_REQUIRED }

    private interface AccessStrategy {
        Decision decide(boolean hasPremium);
    }

    private static final class FreeAccessStrategy implements AccessStrategy {
        @Override public Decision decide(boolean hasPremium) { return Decision.ALLOWED; }
    }

    private static final class PremiumAccessStrategy implements AccessStrategy {
        @Override public Decision decide(boolean hasPremium) {
            return hasPremium ? Decision.ALLOWED : Decision.PREMIUM_REQUIRED;
        }
    }

    private static final AccessStrategy FREE = new FreeAccessStrategy();
    private static final AccessStrategy PREMIUM = new PremiumAccessStrategy();

    private VideoAccessPolicy() {}

    static Decision decide(Map<String, Object> video, Long userId, boolean hasPremium) {
        boolean owner = userId != null && ((Number) video.get("creatorId")).longValue() == userId;
        if (owner) return Decision.ALLOWED;
        if (!"PUBLISHED".equals(video.get("status"))) return Decision.HIDDEN;

        AccessStrategy strategy = switch (String.valueOf(video.get("accessType"))) {
            case "FREE" -> FREE;
            case "PREMIUM" -> PREMIUM;
            default -> throw new IllegalArgumentException("Invalid video access type");
        };
        return strategy.decide(hasPremium);
    }
}
