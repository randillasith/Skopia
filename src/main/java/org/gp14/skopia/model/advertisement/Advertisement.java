package org.gp14.skopia.model.advertisement;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "advertisements")
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

    @Column(name = "ad_type", nullable = false, length = 50)
    private String adType;

    @Column(name = "ad_duration", nullable = false)
    private Integer adDuration; // in seconds

    @Column(name = "click_url", length = 500)
    private String clickUrl;
}
