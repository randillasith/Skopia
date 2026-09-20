package org.gp14.skopia.model.interaction;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.video.Video;

import java.time.LocalDateTime;

@Entity
@Table(name = "watch_history")
@Getter
@Setter
@NoArgsConstructor
public class WatchHistory {

    @EmbeddedId
    private WatchHistoryId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("viewerId")
    @JoinColumn(name = "viewer_id")
    @org.hibernate.annotations.NotFound(action = org.hibernate.annotations.NotFoundAction.IGNORE)
    private RegisteredViewer viewer;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("videoId")
    @JoinColumn(name = "video_id")
    @org.hibernate.annotations.NotFound(action = org.hibernate.annotations.NotFoundAction.IGNORE)
    private Video video;

    @Column(name = "watched_datetime", nullable = false, columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime watchedDatetime;

    @Column(name = "last_position", nullable = false)
    private Integer lastPosition = 0;

    @Column(name = "is_completed", nullable = false)
    private Boolean isCompleted = false;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        watchedDatetime = LocalDateTime.now();
    }
}
