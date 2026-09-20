package org.gp14.skopia.video.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VideoResponse {
    private Long id;
    private String title;
    private String description;
    private String videoUrl;
    private String thumbnailUrl;
    private Integer durationSeconds;
    private Long viewCount;
    private String accessType;
    private String status;
    private String uploadedAt;
    private Long categoryId;
    private String category;
    private Long creatorId;
    private String creatorName;
    private String creatorAvatar;
    private Long likeCount;
    private Boolean liked;
    private Boolean saved;
    private Integer lastPosition;
}
