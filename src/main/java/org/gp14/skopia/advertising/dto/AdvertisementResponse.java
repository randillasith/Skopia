package org.gp14.skopia.advertising.dto;

import org.gp14.skopia.advertising.AdStatus;
import org.gp14.skopia.advertising.AdType;

import java.time.LocalDateTime;
import java.util.List;

public record AdvertisementResponse(
        Long id,
        Long campaignId,
        String campaignName,
        String adTitle,
        String mediaUrl,
        AdType adType,
        Integer adDuration,
        String clickUrl,
        AdStatus status,
        /** False once the campaign's window has closed, whatever {@code status} says. */
        boolean servable,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<PlacementResponse> placements,
        long impressions,
        long clicks,
        double ctr
) {}
