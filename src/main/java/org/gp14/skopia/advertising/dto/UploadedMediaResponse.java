package org.gp14.skopia.advertising.dto;

import org.gp14.skopia.advertising.AdType;

/**
 * Where an uploaded creative now lives.
 *
 * <p>{@code adType} is inferred from the file rather than asked for again: the
 * upload already knows whether it handled a video or a still, and asking the
 * officer to restate it is how a video ends up recorded as an image.
 */
public record UploadedMediaResponse(
        String mediaUrl,
        String originalFilename,
        long sizeBytes,
        String contentType,
        AdType adType
) {}
