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
public class WatchHistoryResponse {
    private Long id;
    private String title;
    private String thumbnailUrl;
    private Integer durationSeconds;
    private Long viewCount;
    private Integer lastPosition;
    private Boolean completed;
    private String watchedAt;
    private String category;
}
