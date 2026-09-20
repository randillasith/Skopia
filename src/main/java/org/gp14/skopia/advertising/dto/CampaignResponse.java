package org.gp14.skopia.advertising.dto;

import org.gp14.skopia.advertising.CampaignStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * A campaign as the management screens read it.
 *
 * <p>{@code status} is the derived one, so the list can never show ACTIVE against a
 * campaign that ended last night. {@code storedStatus} is kept alongside it so the
 * UI can tell "paused by someone" apart from "past its end date" — the two look the
 * same if only one of them is sent.
 */
public record CampaignResponse(
        Long id,
        String campaignName,
        String advertiser,
        CampaignStatus status,
        CampaignStatus storedStatus,
        LocalDateTime startDate,
        LocalDateTime endDate,
        BigDecimal budget,
        Long createdById,
        String createdByName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        int adCount,
        List<String> targets,
        long impressions,
        long clicks,
        double ctr
) {}
