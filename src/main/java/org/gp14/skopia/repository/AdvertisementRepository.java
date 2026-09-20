package org.gp14.skopia.repository;

import org.gp14.skopia.model.advertisement.Advertisement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdvertisementRepository extends JpaRepository<Advertisement, Long> {
    List<Advertisement> findByCampaignId(Long campaignId);
}
