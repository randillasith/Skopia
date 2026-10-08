package org.gp14.skopia.model.advertisement;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.advertising.CampaignStatus;
import org.gp14.skopia.model.user.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A booking: an advertiser, a budget, a window, and the advertisements inside it.
 *
 * <p>The campaign owns the schedule. Its advertisements do not carry dates of their
 * own — a placement may narrow the window, never widen it — so there is one answer
 * to "is this running?" rather than three that can disagree.
 */
@Entity
@Table(name = "ad_campaigns", indexes = {
        @Index(name = "ix_campaign_status", columnList = "campaign_status"),
        @Index(name = "ix_campaign_window", columnList = "start_date,end_date")
})
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
    private User createdBy;

    @Column(name = "campaign_name", nullable = false, length = 100)
    private String campaignName;

    /**
     * Who the campaign runs for. Not in the EER, which assumed the officer's own
     * department was the advertiser; the campaign list is unreadable without it.
     */
    @Column(name = "advertiser", length = 150)
    private String advertiser;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDateTime endDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal budget = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "campaign_status", nullable = false, length = 20)
    private CampaignStatus campaignStatus = CampaignStatus.DRAFT;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * The status the clock implies right now, which is what delivery goes by.
     *
     * <p>A status a person chose — draft, paused, archived — is never overridden;
     * everything else is derived, so a campaign that ended overnight reads as
     * expired on the next request whether or not the sweep has run yet.
     */
    public CampaignStatus effectiveStatus(LocalDateTime at) {
        if (campaignStatus != null && campaignStatus.chosenByHand()) {
            return campaignStatus;
        }
        if (endDate != null && !at.isBefore(endDate)) return CampaignStatus.EXPIRED;
        if (startDate != null && at.isBefore(startDate)) return CampaignStatus.SCHEDULED;
        return CampaignStatus.ACTIVE;
    }
}
