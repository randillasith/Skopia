package org.gp14.skopia.advertising.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.gp14.skopia.advertising.AdType;

public record AdvertisementRequest(
        @NotNull(message = "An advertisement must belong to a campaign.")
        Long campaignId,

        @NotBlank(message = "Give the advertisement a title.")
        @Size(max = 100) String adTitle,

        @NotBlank(message = "Upload creative, or give the URL of creative already stored.")
        @Size(max = 500) String mediaUrl,

        @NotNull(message = "Say whether the creative is a video or an image.")
        AdType adType,

        @PositiveOrZero(message = "Duration cannot be negative.")
        Integer adDuration,

        @Size(max = 500) String clickUrl
) {}
