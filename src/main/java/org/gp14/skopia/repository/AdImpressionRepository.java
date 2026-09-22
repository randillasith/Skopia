package org.gp14.skopia.repository;

import org.gp14.skopia.advertising.dto.MetricPointRow;
import org.gp14.skopia.advertising.dto.MetricTotalsRow;
import org.gp14.skopia.model.advertisement.AdImpression;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Delivery logs, and every figure the dashboards draw from them.
 *
 * <p>The aggregates are computed in the database rather than in Java. Impressions
 * are the one table that grows without bound, and a campaign that has run for a
 * month is already millions of rows — loading them to count them is the version of
 * this that works in a demo and falls over in front of a marker.
 */
@Repository
public interface AdImpressionRepository extends JpaRepository<AdImpression, Long> {

    /**
     * The most recent impression of one placement to one identified viewer.
     *
     * <p>Used to collapse repeats. A player that remounts, a viewer who refreshes,
     * or a client that retries all ask for the same advertisement again within
     * seconds, and every one of those used to be a separate row an advertiser was
     * billed for.
     */
    @Query("""
            SELECT i FROM AdImpression i
            WHERE i.placement.id = :placementId
              AND i.viewer.id = :viewerId
              AND i.shownAt >= :since
            ORDER BY i.shownAt DESC
            LIMIT 1
            """)
    java.util.Optional<AdImpression> findRecent(@Param("placementId") Long placementId,
                                                @Param("viewerId") Long viewerId,
                                                @Param("since") LocalDateTime since);

    @Query("""
            SELECT new org.gp14.skopia.advertising.dto.MetricTotalsRow(
                       COUNT(i), SUM(CASE WHEN i.wasClicked = TRUE THEN 1 ELSE 0 END))
            FROM AdImpression i
            WHERE i.placement.advertisement.campaign.id = :campaignId
              AND i.shownAt >= :from AND i.shownAt < :to
            """)
    MetricTotalsRow totalsForCampaign(@Param("campaignId") Long campaignId,
                                      @Param("from") LocalDateTime from,
                                      @Param("to") LocalDateTime to);

    @Query("""
            SELECT new org.gp14.skopia.advertising.dto.MetricTotalsRow(
                       COUNT(i), SUM(CASE WHEN i.wasClicked = TRUE THEN 1 ELSE 0 END))
            FROM AdImpression i
            WHERE i.placement.advertisement.id = :adId
              AND i.shownAt >= :from AND i.shownAt < :to
            """)
    MetricTotalsRow totalsForAd(@Param("adId") Long adId,
                                @Param("from") LocalDateTime from,
                                @Param("to") LocalDateTime to);

    /** Daily series for a campaign. The x-axis of the trend chart. */
    @Query("""
            SELECT new org.gp14.skopia.advertising.dto.MetricPointRow(
                       EXTRACT(YEAR FROM i.shownAt),
                       EXTRACT(MONTH FROM i.shownAt),
                       EXTRACT(DAY FROM i.shownAt),
                       COUNT(i), SUM(CASE WHEN i.wasClicked = TRUE THEN 1 ELSE 0 END))
            FROM AdImpression i
            WHERE i.placement.advertisement.campaign.id = :campaignId
              AND i.shownAt >= :from AND i.shownAt < :to
            GROUP BY EXTRACT(YEAR FROM i.shownAt),
                     EXTRACT(MONTH FROM i.shownAt),
                     EXTRACT(DAY FROM i.shownAt)
            ORDER BY EXTRACT(YEAR FROM i.shownAt),
                     EXTRACT(MONTH FROM i.shownAt),
                     EXTRACT(DAY FROM i.shownAt)
            """)
    List<MetricPointRow> dailyForCampaign(@Param("campaignId") Long campaignId,
                                          @Param("from") LocalDateTime from,
                                          @Param("to") LocalDateTime to);

    @Query("""
            SELECT new org.gp14.skopia.advertising.dto.MetricPointRow(
                       EXTRACT(YEAR FROM i.shownAt),
                       EXTRACT(MONTH FROM i.shownAt),
                       EXTRACT(DAY FROM i.shownAt),
                       COUNT(i), SUM(CASE WHEN i.wasClicked = TRUE THEN 1 ELSE 0 END))
            FROM AdImpression i
            WHERE i.placement.advertisement.id = :adId
              AND i.shownAt >= :from AND i.shownAt < :to
            GROUP BY EXTRACT(YEAR FROM i.shownAt),
                     EXTRACT(MONTH FROM i.shownAt),
                     EXTRACT(DAY FROM i.shownAt)
            ORDER BY EXTRACT(YEAR FROM i.shownAt),
                     EXTRACT(MONTH FROM i.shownAt),
                     EXTRACT(DAY FROM i.shownAt)
            """)
    List<MetricPointRow> dailyForAd(@Param("adId") Long adId,
                                    @Param("from") LocalDateTime from,
                                    @Param("to") LocalDateTime to);

    /**
     * One breakdown query, with the grouping key chosen by the caller.
     *
     * <p>{@code dimension} is a closed set — video, category, device, slot — and
     * {@code AdAnalyticsService} is the only caller, so the CASE cannot be reached
     * with anything but those four.
     *
     * <p>The title comes from the impression first and the placement second. A
     * category placement names no title, so only the impression knows which one it
     * actually ran against; the placement is the fallback for rows logged before
     * that column existed.
     */
    @Query("""
            SELECT new org.gp14.skopia.advertising.dto.MetricBreakdownRow(
                       CASE :dimension
                            WHEN 'video'    THEN COALESCE(iv.title, pv.title, 'Off a title')
                            WHEN 'category' THEN COALESCE(pc.categoryName, ivc.categoryName, pvc.categoryName, 'Uncategorised')
                            WHEN 'device'   THEN COALESCE(i.deviceType, 'Unknown')
                            ELSE CAST(p.slotPosition AS string)
                       END,
                       COUNT(i), SUM(CASE WHEN i.wasClicked = TRUE THEN 1 ELSE 0 END))
            FROM AdImpression i
            JOIN i.placement p
            LEFT JOIN i.video iv
            LEFT JOIN iv.category ivc
            LEFT JOIN p.video pv
            LEFT JOIN pv.category pvc
            LEFT JOIN p.category pc
            WHERE p.advertisement.campaign.id = :campaignId
              AND i.shownAt >= :from AND i.shownAt < :to
            GROUP BY CASE :dimension
                            WHEN 'video'    THEN COALESCE(iv.title, pv.title, 'Off a title')
                            WHEN 'category' THEN COALESCE(pc.categoryName, ivc.categoryName, pvc.categoryName, 'Uncategorised')
                            WHEN 'device'   THEN COALESCE(i.deviceType, 'Unknown')
                            ELSE CAST(p.slotPosition AS string)
                     END
            ORDER BY COUNT(i) DESC
            """)
    List<org.gp14.skopia.advertising.dto.MetricBreakdownRow> breakdownForCampaign(
            @Param("campaignId") Long campaignId,
            @Param("dimension") String dimension,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /** Per-advertisement totals for one campaign, for the campaign overview table. */
    @Query("""
            SELECT new org.gp14.skopia.advertising.dto.MetricBreakdownRow(
                       a.adTitle,
                       COUNT(i), SUM(CASE WHEN i.wasClicked = TRUE THEN 1 ELSE 0 END))
            FROM AdImpression i
            JOIN i.placement p
            JOIN p.advertisement a
            WHERE a.campaign.id = :campaignId
              AND i.shownAt >= :from AND i.shownAt < :to
            GROUP BY a.adTitle
            ORDER BY COUNT(i) DESC
            """)
    List<org.gp14.skopia.advertising.dto.MetricBreakdownRow> byAdvertisement(
            @Param("campaignId") Long campaignId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);
}
