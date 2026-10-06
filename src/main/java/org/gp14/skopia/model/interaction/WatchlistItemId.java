package org.gp14.skopia.model.interaction;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class WatchlistItemId implements Serializable {

    @Column(name = "watchlist_id")
    private Long watchlistId;

    @Column(name = "video_id")
    private Long videoId;
}
