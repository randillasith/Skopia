package org.gp14.skopia.repository;

import org.gp14.skopia.model.interaction.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchlistRepository extends JpaRepository<Watchlist, Long> {
    List<Watchlist> findByViewerId(Long viewerId);
    Optional<Watchlist> findFirstByViewerId(Long viewerId);
}
