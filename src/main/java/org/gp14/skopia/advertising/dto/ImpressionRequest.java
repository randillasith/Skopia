package org.gp14.skopia.advertising.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Record that an advertisement was shown.
 *
 * <p>Only needed when a client renders a placement it already held — the serving
 * endpoint logs its own impressions. {@code viewerId} is null for a guest.
 */
public record ImpressionRequest(
        @NotNull(message = "An impression must name the placement that was shown.")
        Long placementId,
        /** The title it ran against. Needed for the by-video breakdown to work. */
        Long videoId,
        Long viewerId,
        String deviceType
) {}
