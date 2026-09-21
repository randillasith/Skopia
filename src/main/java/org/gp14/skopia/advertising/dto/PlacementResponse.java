package org.gp14.skopia.advertising.dto;

import org.gp14.skopia.advertising.SlotPosition;

import java.time.LocalDateTime;

public record PlacementResponse(
        Long id,
        Long adId,
        Long videoId,
        String videoTitle,
        Long categoryId,
        String categoryName,
        SlotPosition slotPosition,
        Integer priority,
        LocalDateTime activeFrom,
        LocalDateTime activeTo,
        /** "video" or "category" — what the UI groups the chip list by. */
        String targetKind,
        String targetLabel
) {}
