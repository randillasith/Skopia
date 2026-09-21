package org.gp14.skopia.model.video;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "subtitles")
@Getter
@Setter
@NoArgsConstructor
public class Subtitle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "subtitle_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "video_id", nullable = false)
    private Video video;

    @Column(nullable = false, length = 50)
    private String language;

    @Column(name = "subtitle_format", nullable = false, length = 20)
    private String subtitleFormat = "VTT";

    @Column(name = "subtitle_url", nullable = false, length = 500)
    private String subtitleUrl;
}
