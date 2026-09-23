package org.gp14.skopia.advertising.dto;

import java.time.LocalDate;

/**
 * One day of the delivery series, as the database grouped it.
 *
 * <p>The day arrives as three integers rather than a date because that is the one
 * shape every dialect agrees on: {@code CAST(... AS date)} hands back a
 * {@code java.sql.Date} that a record cannot be constructed from, and
 * {@code DATE(...)} is native SQL. {@code EXTRACT} is standard JPQL, so the same
 * query runs against MySQL in production and H2 in the tests.
 */
public record MetricPointRow(Integer year, Integer month, Integer dayOfMonth,
                             long impressions, Long clicks) {

    public LocalDate day() {
        return LocalDate.of(year, month, dayOfMonth);
    }

    public long clickCount() {
        return clicks == null ? 0L : clicks;
    }
}
