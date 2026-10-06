package org.gp14.skopia.advertising.dto;

/**
 * Who the caller is, as far as advertising is concerned.
 *
 * <p>{@code actorId} is the value the client then sends back as {@code X-User-Id}
 * on every management call.
 */
public record AdvertisingSessionResponse(
        Long actorId,
        String handle,
        String displayName,
        /** "marketing officer" or "administrator" — what the console shows. */
        String role,
        /** False for an administrator, who may read everything but own no booking. */
        boolean canOwnCampaigns
) {}
