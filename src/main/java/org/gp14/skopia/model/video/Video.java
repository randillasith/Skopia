package org.gp14.skopia.model.video;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.ContentCreator;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "videos")
@Getter
@Setter
@NoArgsConstructor
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "video_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creator_id", nullable = false)
    private ContentCreator creator;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tier_id", nullable = false)
    private AccessTier accessTier;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "upload_date", nullable = false, updatable = false)
    private LocalDateTime uploadDate;

    @Column(nullable = false)
    private Integer duration; // in seconds

    @Column(name = "view_count", nullable = false)
    private Long viewCount = 0L;

    @Column(length = 20)
    private String resolution;

    @Column(name = "video_status", nullable = false, length = 20)
    private String videoStatus = "PUBLIC";

    @ManyToMany
    @JoinTable(
            name = "video_tags",
            joinColumns = @JoinColumn(name = "video_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        if (uploadDate == null) {
            uploadDate = LocalDateTime.now();
        }
    }
}
