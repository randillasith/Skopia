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
public class VideoLikeId implements Serializable {

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "video_id")
    private Long videoId;
}
