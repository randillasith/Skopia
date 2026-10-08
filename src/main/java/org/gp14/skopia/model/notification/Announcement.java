package org.gp14.skopia.model.notification;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.User;

import java.time.LocalDateTime;

@Entity
@Table(name = "announcements")
@Getter @Setter @NoArgsConstructor
public class Announcement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ann_id") private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "published_by", nullable = false) private User publishedBy;
    @Column(name = "ann_title", nullable = false, length = 255) private String annTitle;
    @Column(name = "ann_body", nullable = false, columnDefinition = "TEXT") private String annBody;
    @Column(name = "publish_date") private LocalDateTime publishDate;
    @Column(nullable = false, length = 50) private String audience = "ALL";
    @Column(nullable = false, length = 20) private String status = "DRAFT";
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    @PrePersist protected void onCreate() { createdAt = createdAt == null ? LocalDateTime.now() : createdAt; updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
