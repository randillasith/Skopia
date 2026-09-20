package org.gp14.skopia.repository;

import org.gp14.skopia.model.user.ContentCreator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContentCreatorRepository extends JpaRepository<ContentCreator, Long> {
    List<ContentCreator> findByIsVerified(boolean isVerified);
}
