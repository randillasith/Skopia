package org.gp14.skopia.model.advertisement;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.MarketingOfficer;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ad_campaigns")
@Getter
@Setter
@NoArgsConstructor
public class AdCampaign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "campaign_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private MarketingOfficer createdBy;

    @Column(name = "campaign_name", nullable = false, length = 100)
    private String campaignName;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDateTime endDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal budget;

    @Column(name = "campaign_status", nullable = false, length = 20)
    private String campaignStatus = "SCHEDULED";
}
