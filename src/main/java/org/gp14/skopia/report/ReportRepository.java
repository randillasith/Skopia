package org.gp14.skopia.report;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByViewerIdOrderByCreatedAtDesc(Long viewerId);
}
