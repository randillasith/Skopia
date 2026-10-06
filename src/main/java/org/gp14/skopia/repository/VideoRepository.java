package org.gp14.skopia.repository;

import org.gp14.skopia.model.video.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {
    java.util.Optional<Video> findFirstByVideoUrl(String videoUrl);
    java.util.Optional<Video> findFirstByThumbnailUrl(String thumbnailUrl);
    List<Video> findByCategoryId(Long categoryId);

    /**
     * How many titles sit in each category, in one query.
     *
     * <p>The targeting picker shows a count beside every category. Asking per
     * category meant a query each, and asking by loading the titles meant loading
     * the catalogue to call {@code .size()} on it.
     */
    @Query("""
            SELECT v.category.id, COUNT(v) FROM Video v
            WHERE v.category.id IS NOT NULL
            GROUP BY v.category.id
            """)
    List<Object[]> countByCategory();

    /**
     * Titles matching a search, capped by the database rather than in memory.
     *
     * <p>An empty needle matches everything, which is what an unfiltered picker
     * wants — but it wants the first page of it, not the whole catalogue.
     */
    @Query("""
            SELECT v FROM Video v
            LEFT JOIN FETCH v.category
            WHERE :needle = '' OR LOWER(v.title) LIKE CONCAT('%', :needle, '%')
            ORDER BY v.title ASC
            """)
    List<Video> searchForTargeting(@Param("needle") String needle,
                                   org.springframework.data.domain.Pageable page);
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
