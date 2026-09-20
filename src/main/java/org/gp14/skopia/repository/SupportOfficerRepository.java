package org.gp14.skopia.repository;

import org.gp14.skopia.model.user.SupportOfficer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SupportOfficerRepository extends JpaRepository<SupportOfficer, Long> {
}
