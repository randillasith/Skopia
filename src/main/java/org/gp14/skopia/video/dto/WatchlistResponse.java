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
public class WatchlistResponse {
    private Long id;
    private String title;
    private String thumbnailUrl;
    private Integer durationSeconds;
    private Long viewCount;
    private String category;
    private String addedAt;
}
