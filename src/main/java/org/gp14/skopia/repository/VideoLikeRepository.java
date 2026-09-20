package org.gp14.skopia.repository;

import org.gp14.skopia.model.interaction.VideoLike;
import org.gp14.skopia.model.interaction.VideoLikeId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VideoLikeRepository extends JpaRepository<VideoLike, VideoLikeId> {
    long countByIdVideoId(Long videoId);
}
