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
public class WatchHistoryId implements Serializable {

    @Column(name = "viewer_id")
    private Long viewerId;

    @Column(name = "video_id")
    private Long videoId;
}
