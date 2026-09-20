package org.gp14.skopia.repository;

import org.gp14.skopia.model.video.AccessTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AccessTierRepository extends JpaRepository<AccessTier, Long> {
    Optional<AccessTier> findByTierNameIgnoreCase(String tierName);
}
