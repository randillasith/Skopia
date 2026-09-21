package org.gp14.skopia.model.advertisement;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.advertising.AdStatus;
import org.gp14.skopia.advertising.AdType;

import java.time.LocalDateTime;

/**
 * One piece of creative inside a campaign: what a viewer actually sees.
 *
 * <p>Scheduling lives on the campaign and targeting lives on {@link AdPlacement},
 * so an advertisement is only its content plus a switch.
 */
@Entity
@Table(name = "advertisements", indexes = {
        @Index(name = "ix_ad_campaign", columnList = "campaign_id"),
        @Index(name = "ix_ad_status", columnList = "ad_status")
})
@Getter
@Setter
@NoArgsConstructor
public class Advertisement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ad_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campaign_id", nullable = false)
    private AdCampaign campaign;

    @Column(name = "ad_title", nullable = false, length = 100)
    private String adTitle;

    @Column(name = "media_url", nullable = false, length = 500)
    private String mediaUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "ad_type", nullable = false, length = 50)
    private AdType adType = AdType.VIDEO;

    /** Seconds. Zero for a still image, which has no duration of its own. */
    @Column(name = "ad_duration", nullable = false)
    private Integer adDuration = 0;

    /** Where a click sends the viewer. Null means the creative is not clickable. */
    @Column(name = "click_url", length = 500)
    private String clickUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "ad_status", nullable = false, length = 20)
    private AdStatus adStatus = AdStatus.DRAFT;

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
}
