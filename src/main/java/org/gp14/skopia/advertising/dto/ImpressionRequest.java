package org.gp14.skopia.advertising.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Record that an advertisement was shown.
 *
 * <p>Only needed when a client renders a placement it already held — the serving
 * endpoint logs its own impressions.
 *
 * <p>There is deliberately no {@code viewerId} here. Who saw an advertisement is
 * taken from the request's bearer token, not from its body: an advertiser is
 * billed per impression, so a field letting the caller name any viewer it likes
 * is a field letting it write delivery records against strangers.
 */
public record ImpressionRequest(
        @NotNull(message = "An impression must name the placement that was shown.")
        Long placementId,
        /** The title it ran against. Needed for the by-video breakdown to work. */
        Long videoId,
        @Size(max = 50, message = "Device type is limited to 50 characters.")
        String deviceType
) {}
