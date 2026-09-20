package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.UploadedMediaResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** What the creative upload accepts, and what it refuses. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdMediaStorageServiceTest {

    @Autowired AdMediaStorageService media;
    @Autowired AdvertisingFixture fixture;

    private Long actor;

    @BeforeEach
    void setUp() {
        actor = fixture.officer().getId();
    }

    @Test
    @DisplayName("a video is stored under a generated name and typed from the file")
    void storesAVideo() {
        UploadedMediaResponse stored = media.store(actor, new MockMultipartFile(
                "file", "autumn-trailer.mp4", "video/mp4", new byte[] { 1, 2, 3 }));

        assertThat(stored.adType()).isEqualTo(AdType.VIDEO);
        assertThat(stored.originalFilename()).isEqualTo("autumn-trailer.mp4");
        assertThat(stored.mediaUrl()).startsWith("/uploads/ads/").endsWith(".mp4");
        assertThat(stored.mediaUrl())
                .as("the client's own filename never reaches the URL")
                .doesNotContain("autumn-trailer");
    }

    @Test
    @DisplayName("an image is recognised as one, so nobody has to restate it")
    void storesAnImage() {
        assertThat(media.store(actor, new MockMultipartFile(
                "file", "standee.png", "image/png", new byte[] { 1 })).adType())
                .isEqualTo(AdType.IMAGE);
    }

    @Test
    @DisplayName("an unsupported format is refused, and says which are accepted")
    void refusesAnUnsupportedFormat() {
        assertThatThrownBy(() -> media.store(actor, new MockMultipartFile(
                "file", "payload.svg", "image/svg+xml", new byte[] { 1 })))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("MP4, WebM, MOV, PNG, JPEG, WebP and GIF");
    }

    /**
     * Extension and content type are both checked because either alone is trivially
     * wrong — this is the renamed-script case.
     */
    @Test
    @DisplayName("a file whose name and content type disagree is refused")
    void refusesAMismatch() {
        assertThatThrownBy(() -> media.store(actor, new MockMultipartFile(
                "file", "not-really.png", "application/x-sh", new byte[] { 1 })))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("arrived as application/x-sh");
    }

    @Test
    @DisplayName("a traversal attempt in the filename is just a name")
    void ignoresTraversalInTheFilename() {
        UploadedMediaResponse stored = media.store(actor, new MockMultipartFile(
                "file", "../../../../etc/passwd.png", "image/png", new byte[] { 1 }));

        assertThat(stored.mediaUrl()).doesNotContain("..");
        assertThat(stored.mediaUrl()).startsWith("/uploads/ads/");
    }

    @Test
    @DisplayName("an empty upload, and one over the size limit, are refused")
    void refusesEmptyAndOversized() {
        assertThatThrownBy(() -> media.store(actor, new MockMultipartFile(
                "file", "nothing.mp4", "video/mp4", new byte[0])))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("Choose a file");

        // The configured ceiling is 50 MB; one byte over is the boundary that matters.
        byte[] tooBig = new byte[52_428_801];
        assertThatThrownBy(() -> media.store(actor, new MockMultipartFile(
                "file", "huge.mp4", "video/mp4", tooBig)))
                .isInstanceOf(AdvertisingException.class)
                .hasMessageContaining("The limit is");
    }

    @Test
    @DisplayName("uploading is a staff action")
    void refusesANonStaffUploader() {
        Long viewer = fixture.viewer().getId();
        assertThatThrownBy(() -> media.store(viewer, new MockMultipartFile(
                "file", "trailer.mp4", "video/mp4", new byte[] { 1 })))
                .isInstanceOf(AdvertisingException.class);
    }
}
