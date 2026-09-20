package org.gp14.skopia.video.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateVideoRequest {
    private String title;
    private String description;
    private Long categoryId;
    private String accessType;
    private String status;
    private String videoUrl;
    private String thumbnailUrl;
}
