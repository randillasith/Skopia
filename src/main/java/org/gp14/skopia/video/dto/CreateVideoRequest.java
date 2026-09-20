package org.gp14.skopia.video.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateVideoRequest {
    private String title;
    private String description;
    private Long categoryId;
    private String accessType;
    private String status;
    private Integer durationSeconds;
    private String videoUrl;
    private String thumbnailUrl;
}
