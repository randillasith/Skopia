package org.gp14.skopia.model.interaction;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.video.Video;

import java.time.LocalDateTime;

@Entity
@Table(name = "comments")
@Getter
@Setter
@NoArgsConstructor
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "comment_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "video_id", nullable = false)
    private Video video;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "viewer_id", nullable = false)
    private RegisteredViewer viewer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_comment_id")
    private Comment parentComment;

    @Column(name = "comment_text", nullable = false, columnDefinition = "TEXT")
    private String commentText;

    @Column(name = "posted_datetime", nullable = false, updatable = false)
    private LocalDateTime postedDatetime;

    @Column(name = "comment_status", nullable = false, length = 20)
    private String commentStatus = "VISIBLE";

    @PrePersist
    protected void onCreate() {
        if (postedDatetime == null) {
            postedDatetime = LocalDateTime.now();
        }
    }
}
