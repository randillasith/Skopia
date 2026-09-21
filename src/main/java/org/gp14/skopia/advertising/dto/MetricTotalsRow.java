package org.gp14.skopia.advertising.dto;

/**
 * A raw aggregate straight out of the database.
 *
 * <p>{@code clicks} is boxed because {@code SUM} over an empty window is null, not
 * zero. {@link #clickCount()} is the value the rest of the code should use.
 */
public record MetricTotalsRow(long impressions, Long clicks) {

    public long clickCount() {
        return clicks == null ? 0L : clicks;
    }
}
