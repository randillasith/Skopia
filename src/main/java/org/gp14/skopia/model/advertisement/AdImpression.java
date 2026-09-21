package org.gp14.skopia.model.advertisement;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.video.Video;

import java.time.LocalDateTime;

/**
 * One advertisement, shown once.
 *
 * <p>A click is recorded on the impression it belongs to rather than in a table of
 * its own: a click without a preceding impression is not a thing that can happen,
 * and keeping them together is what makes CTR a count over one set of rows instead
 * of a join that can silently drop unmatched clicks.
 *
 * <p>{@link #viewer} is null for a signed-out viewer. That is a real case, not a
 * missing value — guests see advertisements too.
 *
 * <p>{@link #video} is recorded separately from the placement, and has to be: a
 * placement that targets a category does not name a title, so without this the
 * "which titles did this campaign actually run against?" breakdown can only answer
 * "a category" — which is the question, not the answer.
 */
@Entity
@Table(name = "ad_impressions", indexes = {
        @Index(name = "ix_impression_placement", columnList = "placement_id"),
        @Index(name = "ix_impression_video", columnList = "video_id"),
        @Index(name = "ix_impression_shown_at", columnList = "shown_at")
})
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

    /** The title this ran against. Null only for a slot outside playback. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id")
    private Video video;

    @Column(name = "shown_at", nullable = false)
    private LocalDateTime shownAt;

    @Column(name = "was_clicked", nullable = false)
    private Boolean wasClicked = false;

    /** When the click happened. Null while {@link #wasClicked} is false. */
    @Column(name = "clicked_at")
    private LocalDateTime clickedAt;

    @Column(name = "device_type", length = 50)
    private String deviceType;

    @PrePersist
    void onCreate() {
        if (shownAt == null) {
            shownAt = LocalDateTime.now();
        }
        if (wasClicked == null) {
            wasClicked = false;
        }
    }
}
