package org.gp14.skopia.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties={"skopia.mail.enabled=true", "skopia.mail.host=localhost", "skopia.mail.username=test",
        "skopia.mail.password=test", "skopia.mail.from=notifications@example.test",
        "skopia.password-reset.public-origin=http://invalid.example.test"})
class PasswordResetInvalidOriginTest {
    @Autowired MockMvc mvc;
    @MockBean(name="billingMailSender") JavaMailSender sender;

    @Test void invalidCanonicalOriginFailsForAnyAddressWithoutSending() throws Exception {
        var first=mvc.perform(post("/api/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"someone@example.test\"}" )).andReturn().getResponse();
        var second=mvc.perform(post("/api/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"unknown@example.test\"}" )).andReturn().getResponse();
        assertThat(first.getStatus()).isEqualTo(503);
        assertThat(second.getStatus()).isEqualTo(first.getStatus());
        assertThat(second.getContentAsString()).isEqualTo(first.getContentAsString());
        verify(sender,never()).send(any(SimpleMailMessage.class));
    }
}
