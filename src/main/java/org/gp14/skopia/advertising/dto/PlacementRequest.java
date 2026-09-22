package org.gp14.skopia.advertising.dto;

import jakarta.validation.constraints.NotNull;
import org.gp14.skopia.advertising.SlotPosition;

import java.time.LocalDateTime;

/**
 * Attach an advertisement to a target.
 *
 * <p>Exactly one of {@code videoId} and {@code categoryId} must be set; the service
 * rejects both and neither. The window is optional and defaults to the campaign's.
 */
public record PlacementRequest(
        Long videoId,
        Long categoryId,

        @NotNull(message = "Choose the slot this placement fills.")
        SlotPosition slotPosition,

        Integer priority,
        LocalDateTime activeFrom,
        LocalDateTime activeTo
) {}
