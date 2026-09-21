package org.gp14.skopia.advertising.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * What a marketing officer sends to create or replace a campaign.
 *
 * <p>Status is not here. A campaign moves between statuses through the named
 * transitions on {@code AdCampaignService} — confirm, pause, resume, archive —
 * because letting a form PUT a status is how a campaign ends up ACTIVE with an end
 * date in the past.
 */
public record CampaignRequest(
        @NotBlank(message = "Give the campaign a name you will recognise in the list.")
        @Size(max = 100, message = "Campaign names are limited to 100 characters.")
        String campaignName,

        @Size(max = 150) String advertiser,

        @NotNull(message = "Set the date the campaign starts running.")
        LocalDateTime startDate,

        @NotNull(message = "Set the date it stops.")
        LocalDateTime endDate,

        @PositiveOrZero(message = "A budget cannot be negative.")
        BigDecimal budget
) {}
