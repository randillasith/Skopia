package org.gp14.skopia.advertising.dto;

import org.gp14.skopia.advertising.AdType;
import org.gp14.skopia.advertising.SlotPosition;

/**
 * One advertisement, ready for the player to show.
 *
 * <p>The impression is already recorded by the time this is returned, which is why
 * it carries an {@code impressionId}: the player does not have to make a second
 * call to say "I showed it", and a click always has an impression to hang from.
 *
 * <p>{@code clickUrl} is the platform's tracking URL, never the advertiser's. The
 * destination is only reachable through the redirect, so a click that skipped the
 * tracker is a click that did not happen.
 */
public record ServedAdResponse(
        Long impressionId,
        Long adId,
        Long placementId,
        String adTitle,
        String advertiser,
        String mediaUrl,
        AdType adType,
        Integer adDuration,
        SlotPosition slotPosition,
        String clickUrl,
        /** Always "Advertisement". The viewer-facing label cannot be turned off. */
        String label
) {}
