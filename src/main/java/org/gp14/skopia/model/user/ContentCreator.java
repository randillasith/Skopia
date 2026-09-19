package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "content_creators")
@PrimaryKeyJoinColumn(name = "viewer_id")
@Getter
@Setter
@NoArgsConstructor
public class ContentCreator extends Viewer {

    @Column(name = "channel_name", nullable = false, length = 100)
    private String channelName;

    @Column(name = "channel_bio", columnDefinition = "TEXT")
    private String channelBio;

    @Column(name = "is_verified", nullable = false)
    private Boolean isVerified = false;

    @Column(name = "total_uploads", nullable = false)
    private Integer totalUploads = 0;
}
