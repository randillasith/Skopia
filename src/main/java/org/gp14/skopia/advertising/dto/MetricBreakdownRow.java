package org.gp14.skopia.advertising.dto;

/** One row of a breakdown — a video, a category, a device or a slot. */
public record MetricBreakdownRow(String label, long impressions, Long clicks) {

    public long clickCount() {
        return clicks == null ? 0L : clicks;
    }
}
