package org.gp14.skopia.video;

import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.VideoRepository;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class UploadedMediaControllerTest {
    @Test void refusesUnreferencedAndRequiresSignedPremiumAccessOnRange() throws Exception {
        VideoRepository videos = mock(VideoRepository.class);
        VideoAccessService access = mock(VideoAccessService.class);
        TokenService tokens = new TokenService("test-only-secret-at-least-thirty-two-characters-long", 3600, org.mockito.Mockito.mock(org.gp14.skopia.repository.UserRepository.class));
        UploadedMediaController controller = new UploadedMediaController(videos, access, tokens);
        String filename = UUID.randomUUID() + ".mp4";
        Path file = Path.of("uploads", filename);
        Files.createDirectories(file.getParent());
        Files.write(file, new byte[]{0,1,2,3,4,5,6,7});
        try {
            assertThatThrownBy(() -> controller.get(filename, null, null, null))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
            Video premium = new Video(); premium.setId(9L);
            when(videos.findFirstByVideoUrl("/uploads/" + filename)).thenReturn(Optional.of(premium));
            when(access.canPlay(premium, null)).thenReturn(false);
            assertThatThrownBy(() -> controller.get(filename, null, "bytes=2-5", null))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
            when(access.canPlay(premium, 5L)).thenReturn(true);
            String signed = tokens.issueMedia(9L, filename, 5L);
            var result = controller.get(filename, signed, "bytes=2-5", null);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.PARTIAL_CONTENT);
            assertThat(result.getBody().getPosition()).isEqualTo(2);
            assertThat(result.getBody().getCount()).isEqualTo(4);
            var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/uploads/" + filename)
                            .param("access", signed).header("Range", "bytes=2-5"))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isPartialContent())
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Content-Range", "bytes 2-5/8"))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().bytes(new byte[]{2,3,4,5}));
            assertThatThrownBy(() -> controller.get(filename, signed + "x", null, null))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        } finally {
            Files.deleteIfExists(file);
        }
    }
}
