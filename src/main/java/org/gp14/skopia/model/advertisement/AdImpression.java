package org.gp14.skopia.model.advertisement;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.RegisteredViewer;

import java.time.LocalDateTime;

@Entity
@Table(name = "ad_impressions")
@Getter
@Setter
@NoArgsConstructor
public class AdImpression {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "impression_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "placement_id", nullable = false)
    private AdPlacement placement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "viewer_id")
    private RegisteredViewer viewer;

    @Column(name = "shown_at", nullable = false)
    private LocalDateTime shownAt;

    @Column(name = "was_clicked", nullable = false)
    private Boolean wasClicked = false;

    @Column(name = "device_type", length = 50)
    private String deviceType;

    @PrePersist
    protected void onCreate() {
        if (shownAt == null) {
            shownAt = LocalDateTime.now();
        }
    }
}
