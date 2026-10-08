package org.gp14.skopia.advertising.dto;

/**
 * Who the caller is, as far as advertising is concerned.
 *
 * <p>{@code actorId} identifies the authenticated account for display only. The
 * API derives authority from the bearer-token principal and never trusts an
 * actor id supplied by the browser.
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
