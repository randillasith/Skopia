package org.gp14.skopia.repository;

import org.gp14.skopia.model.user.MarketingOfficer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MarketingOfficerRepository extends JpaRepository<MarketingOfficer, Long> {
    Optional<MarketingOfficer> findByOfficerCode(String officerCode);
    boolean existsByOfficerCode(String officerCode);
}
