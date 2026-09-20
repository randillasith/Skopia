package org.gp14.skopia.repository;

import org.gp14.skopia.model.interaction.WatchlistItem;
import org.gp14.skopia.model.interaction.WatchlistItemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WatchlistItemRepository extends JpaRepository<WatchlistItem, WatchlistItemId> {
    List<WatchlistItem> findByIdWatchlistIdOrderByAddedDateDesc(Long watchlistId);
}
