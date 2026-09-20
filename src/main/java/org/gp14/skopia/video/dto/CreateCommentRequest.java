package org.gp14.skopia.video.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateCommentRequest {
    private String text;
    private Long parentId;
}
