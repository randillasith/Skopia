package org.gp14.skopia.repository;

import org.gp14.skopia.model.video.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {
    List<Video> findByCategoryId(Long categoryId);
    List<Video> findByCreatorId(Long creatorId);
    List<Video> findByTitleContainingIgnoreCase(String titleKeyword);
    List<Video> findByVideoStatus(String videoStatus);
}
