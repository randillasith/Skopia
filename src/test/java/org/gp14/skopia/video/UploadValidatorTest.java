package org.gp14.skopia.video;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import static org.assertj.core.api.Assertions.*;

class UploadValidatorTest {
    @Test void rejectsSpoofedMimeAndSignature() {
        byte[] fake = "not a movie".getBytes();
        assertThatThrownBy(() -> UploadValidator.validate(new MockMultipartFile("videoFile", "film.mp4", "video/mp4", fake), true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> UploadValidator.validate(new MockMultipartFile("videoFile", "film.mp4", "image/png", fake), true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> UploadValidator.validate(new MockMultipartFile("thumbnailFile", "image.png", "image/png", fake), false))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void acceptsMatchingVideoAndImage() throws Exception {
        byte[] mp4 = new byte[]{0,0,0,16,'f','t','y','p','i','s','o','m',0,0,0,0};
        byte[] png = new byte[]{(byte)137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0};
        assertThat(UploadValidator.validate(new MockMultipartFile("file", "film.mp4", "video/mp4", mp4), true)).isEqualTo(".mp4");
        assertThat(UploadValidator.validate(new MockMultipartFile("file", "thumb.png", "image/png", png), false)).isEqualTo(".png");
    }
}
