package org.gp14.skopia.repository;

import org.gp14.skopia.model.user.RegisteredViewer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RegisteredViewerRepository extends JpaRepository<RegisteredViewer, Long> {
    List<RegisteredViewer> findByIsPremium(boolean isPremium);
    long countByIsPremium(boolean isPremium);
}
