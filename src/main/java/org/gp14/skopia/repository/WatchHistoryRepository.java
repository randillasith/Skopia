package org.gp14.skopia.repository;

import org.gp14.skopia.model.interaction.WatchHistory;
import org.gp14.skopia.model.interaction.WatchHistoryId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WatchHistoryRepository extends JpaRepository<WatchHistory, WatchHistoryId> {
    List<WatchHistory> findByIdViewerIdOrderByWatchedDatetimeDesc(Long viewerId);
}
