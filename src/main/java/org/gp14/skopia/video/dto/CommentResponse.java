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
public class CommentResponse {
    private Long id;
    private String text;
    private String postedAt;
    private Long parentId;
    private Long userId;
    private String displayName;
    private String avatarUrl;
}
