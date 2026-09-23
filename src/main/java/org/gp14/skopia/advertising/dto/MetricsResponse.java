package org.gp14.skopia.advertising.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Everything one performance screen needs, for one subject, over one window.
 *
 * <p>Assembled as a single response because the dashboard draws the headline
 * numbers, the trend and the breakdowns from the same window — fetching them
 * separately lets the three disagree while the page is still loading.
 */
public record MetricsResponse(
        String subject,
        Long subjectId,
        String subjectName,
        LocalDate from,
        LocalDate to,
        long impressions,
        long clicks,
        double ctr,
        List<Point> daily,
        List<Breakdown> breakdowns
) {

    public record Point(LocalDate day, long impressions, long clicks, double ctr) {}

    /** One named dimension — by video, by category, by device, by slot, by ad. */
    public record Breakdown(String dimension, List<Row> rows) {
        public record Row(String label, long impressions, long clicks, double ctr) {}
    }
}
