package org.gp14.skopia.repository;

import org.gp14.skopia.model.video.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {
    List<Video> findByCategoryId(Long categoryId);
    List<Video> findByCreatorId(Long creatorId);
    List<Video> findByTitleContainingIgnoreCase(String titleKeyword);
    List<Video> findByVideoStatus(String videoStatus);

    @Query("SELECT v FROM Video v WHERE " +
           "(:creatorId IS NOT NULL AND v.creator.id = :creatorId) OR " +
           "(:creatorId IS NULL AND (:status IS NULL OR v.videoStatus = :status))")
    List<Video> filterVideos(@Param("creatorId") Long creatorId, @Param("status") String status);

    @Query("SELECT v FROM Video v " +
           "LEFT JOIN v.category c " +
           "LEFT JOIN v.accessTier t " +
           "WHERE (:creatorId IS NOT NULL AND v.creator.id = :creatorId) " +
           "   OR (:creatorId IS NULL AND (:status IS NULL OR v.videoStatus = :status)) " +
           "AND (:categoryId IS NULL OR v.category.id = :categoryId) " +
           "AND (:accessTier IS NULL OR UPPER(t.tierName) = UPPER(:accessTier)) " +
           "AND (:search IS NULL OR LOWER(v.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "     OR LOWER(v.description) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "     OR LOWER(c.categoryName) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY v.uploadDate DESC, v.id DESC")
    List<Video> searchVideos(
            @Param("search") String search,
            @Param("categoryId") Long categoryId,
            @Param("accessTier") String accessTier,
            @Param("creatorId") Long creatorId,
            @Param("status") String status
    );
}
