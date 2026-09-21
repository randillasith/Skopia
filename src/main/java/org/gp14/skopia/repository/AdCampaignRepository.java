package org.gp14.skopia.repository;

import org.gp14.skopia.advertising.CampaignStatus;
import org.gp14.skopia.model.advertisement.AdCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AdCampaignRepository extends JpaRepository<AdCampaign, Long> {

    List<AdCampaign> findByCreatedById(Long officerId);

    /**
     * The campaign list behind the management screen.
     *
     * <p>{@code status} matches the stored column, which is not the same thing as
     * the status the screen shows — between expiry sweeps a lapsed campaign still
     * reads SCHEDULED here. {@code AdCampaignService} therefore passes null and
     * filters the derived status itself; the parameter is kept for callers that
     * genuinely want the stored value, such as the sweep's own bookkeeping.
     */
    @Query("""
            SELECT c FROM AdCampaign c
            WHERE (:status IS NULL OR c.campaignStatus = :status)
              AND (:search IS NULL
                   OR LOWER(c.campaignName) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(c.advertiser)   LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY c.startDate DESC, c.id DESC
            """)
    List<AdCampaign> search(@Param("search") String search,
                            @Param("status") CampaignStatus status);

    /**
     * Campaigns whose end date has passed but whose stored status has not caught up.
     * The expiry sweep works from exactly this list.
     */
    @Query("""
            SELECT c FROM AdCampaign c
            WHERE c.endDate <= :now
              AND c.campaignStatus IN (org.gp14.skopia.advertising.CampaignStatus.SCHEDULED,
                                       org.gp14.skopia.advertising.CampaignStatus.ACTIVE)
            """)
    List<AdCampaign> findLapsed(@Param("now") LocalDateTime now);

    /**
     * Scheduled campaigns that have reached their start date. The other half of the
     * sweep: without it a campaign stays SCHEDULED in the list while already serving.
     */
    @Query("""
            SELECT c FROM AdCampaign c
            WHERE c.startDate <= :now AND c.endDate > :now
              AND c.campaignStatus = org.gp14.skopia.advertising.CampaignStatus.SCHEDULED
            """)
    List<AdCampaign> findStarted(@Param("now") LocalDateTime now);

    long countByCampaignStatus(CampaignStatus status);
}
