package org.gp14.skopia.model.interaction;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.video.Video;

import java.time.LocalDateTime;

@Entity
@Table(name = "watchlist_items")
@Getter
@Setter
@NoArgsConstructor
public class WatchlistItem {

    @EmbeddedId
    private WatchlistItemId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("watchlistId")
    @JoinColumn(name = "watchlist_id")
    private Watchlist watchlist;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("videoId")
    @JoinColumn(name = "video_id")
    private Video video;

    @Column(name = "added_date", nullable = false)
    private LocalDateTime addedDate;

    @PrePersist
    protected void onCreate() {
        if (addedDate == null) {
            addedDate = LocalDateTime.now();
        }
    }
}
