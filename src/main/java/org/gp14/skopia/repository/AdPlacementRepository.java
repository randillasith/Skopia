package org.gp14.skopia.repository;

import org.gp14.skopia.advertising.SlotPosition;
import org.gp14.skopia.model.advertisement.AdPlacement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AdPlacementRepository extends JpaRepository<AdPlacement, Long> {

    List<AdPlacement> findByAdvertisementId(Long adId);

    List<AdPlacement> findByAdvertisementCampaignId(Long campaignId);

    void deleteByAdvertisementId(Long adId);

    boolean existsByAdvertisementIdAndVideoIdAndSlotPosition(Long adId, Long videoId, SlotPosition slot);

    boolean existsByAdvertisementIdAndCategoryIdAndSlotPosition(Long adId, Long categoryId, SlotPosition slot);

    /**
     * Every placement eligible to fill one slot on one video, best first.
     *
     * <p>This is the whole serving rule in one query, and it is deliberately one
     * query: eligibility depends on the campaign window, the campaign status, the
     * advertisement switch and the placement window at once, and checking them in
     * separate passes is how an expired advertisement slips through.
     *
     * <p>A placement matches by title or by the title's category. {@code categoryId}
     * is passed in rather than joined through the video so that a video with no
     * category still answers cleanly instead of matching every category placement.
     */
    @Query("""
            SELECT p FROM AdPlacement p
            JOIN p.advertisement a
            JOIN a.campaign c
            WHERE p.slotPosition = :slot
              AND (p.video.id = :videoId
                   OR (:categoryId IS NOT NULL AND p.category.id = :categoryId))
              AND p.activeFrom <= :now AND p.activeTo > :now
              AND c.startDate  <= :now AND c.endDate  > :now
              AND c.campaignStatus IN (org.gp14.skopia.advertising.CampaignStatus.SCHEDULED,
                                       org.gp14.skopia.advertising.CampaignStatus.ACTIVE)
              AND a.adStatus = org.gp14.skopia.advertising.AdStatus.ACTIVE
            ORDER BY p.priority DESC, p.id ASC
            """)
    List<AdPlacement> findEligible(@Param("videoId") Long videoId,
                                   @Param("categoryId") Long categoryId,
                                   @Param("slot") SlotPosition slot,
                                   @Param("now") LocalDateTime now);
}
