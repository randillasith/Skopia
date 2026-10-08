package org.gp14.skopia.user;

import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties={"skopia.mail.enabled=false", "skopia.password-reset.public-origin=https://app.example.test"})
class PasswordResetDisabledTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;

    @Test void disabledTransportOrOriginNeverEnumeratesExistingAddresses() throws Exception {
        RegisteredViewer user=new RegisteredViewer();
        user.setUsername("disabled_reset_test"); user.setEmail("disabled-reset@example.test");
        user.setPasswordHash("irrelevant-test-hash"); user.setPreferredLanguage("en");
        user.setIsPremium(false); user.setNotifyChannel("EMAIL");
        viewers.saveAndFlush(user);
        try {
            var known=mvc.perform(post("/api/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"disabled-reset@example.test\"}" )).andReturn().getResponse();
            var unknown=mvc.perform(post("/api/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"unknown-disabled@example.test\"}" )).andReturn().getResponse();
            assertThat(known.getStatus()).isEqualTo(503);
            assertThat(unknown.getStatus()).isEqualTo(known.getStatus());
            assertThat(unknown.getContentAsString()).isEqualTo(known.getContentAsString());
        } finally { viewers.delete(user); }
    }
}
