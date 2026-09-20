package org.gp14.skopia.model.advertisement;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.advertising.SlotPosition;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;

import java.time.LocalDateTime;

/**
 * The targeting rule: this advertisement, in this slot, against this video or
 * this category.
 *
 * <p>Exactly one of {@link #video} and {@link #category} is set. A placement with
 * both would be ambiguous about what it targets, and one with neither would target
 * the whole platform by accident — {@link org.gp14.skopia.advertising.AdPlacementService}
 * rejects both shapes rather than guessing.
 *
 * <p>{@link #activeFrom}/{@link #activeTo} may narrow the campaign's window (a
 * placement that only runs for the first week of a month-long booking) but never
 * widen it; the serving query intersects the two.
 */
@Entity
@Table(name = "ad_placements", indexes = {
        @Index(name = "ix_placement_video", columnList = "video_id"),
        @Index(name = "ix_placement_category", columnList = "category_id"),
        @Index(name = "ix_placement_slot", columnList = "slot_position")
})
@Getter
@Setter
@NoArgsConstructor
public class AdPlacement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "placement_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ad_id", nullable = false)
    private Advertisement advertisement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id")
    private Video video;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(name = "slot_position", nullable = false, length = 50)
    private SlotPosition slotPosition = SlotPosition.PREROLL;

    /** Higher wins when more than one placement is eligible for the same slot. */
    @Column(nullable = false)
    private Integer priority = 1;

    @Column(name = "active_from", nullable = false)
    private LocalDateTime activeFrom;

    @Column(name = "active_to", nullable = false)
    private LocalDateTime activeTo;

    /** True when this placement targets one title rather than a whole category. */
    @Transient
    public boolean targetsVideo() {
        return video != null;
    }
}
