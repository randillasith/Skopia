package org.gp14.skopia.advertising.dto;

import java.util.List;

/**
 * What the targeting picker chooses from.
 *
 * <p>Both lists come back in one call. They are always shown side by side, and two
 * calls means the screen can render with one half of the picker missing.
 */
public record TargetOptionsResponse(List<Option> categories, List<Option> videos) {

    /** {@code count} is the number of titles behind a category; null for a video. */
    public record Option(Long id, String label, String sublabel, Long count) {}
}
