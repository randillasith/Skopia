package org.gp14.skopia.user;

import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.security.PasswordService;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Documents the server-side boundary while self-service JOINED-subtype migration is unavailable. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ChannelCreationUnavailableIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired UserRepository users;
    @Autowired TokenService tokens;
    @Autowired PasswordService passwords;

    @Test
    void registeredViewerCannotBecomeCreatorThroughAClientClaim() throws Exception {
        RegisteredViewer viewer = new RegisteredViewer();
        viewer.setUsername("channel_viewer");
        viewer.setEmail("channel_viewer@example.test");
        viewer.setPasswordHash(passwords.encode(java.util.UUID.randomUUID().toString()));
        viewer.setAccountStatus("ACTIVE");
        viewer = viewers.saveAndFlush(viewer);
        Long id = viewer.getId();
        String token = "Bearer " + tokens.issue(id);

        mvc.perform(get("/api/auth/me").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roleType").value("REGISTERED_VIEWER"));
        // Neither a forged actor header nor a claimed role can authorize a creator upload.
        mvc.perform(post("/api/videos").header("Authorization", token)
                        .header("X-User-Id", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleType\":\"CONTENT_CREATOR\",\"channelName\":\"False Studio\"}"))
                .andExpect(status().isForbidden());
        assertThat(users.findById(id).orElseThrow()).isInstanceOf(RegisteredViewer.class);
    }
}
