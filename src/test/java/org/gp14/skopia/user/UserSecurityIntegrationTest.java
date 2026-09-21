package org.gp14.skopia.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.ActivityLog;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.ActivityLogRepository;
import org.gp14.skopia.repository.AdministratorRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.security.PasswordService;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserSecurityIntegrationTest {
    @Autowired MockMvc mvc;
    ObjectMapper json = new ObjectMapper();
    @Autowired AdministratorRepository administrators;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired PasswordService passwords;
    @Autowired TokenService tokens;
    @Autowired ActivityLogRepository activityLogs;
    Administrator admin;
    RegisteredViewer viewer;

    @BeforeEach
    void setUp() {
        admin = new Administrator();
        admin.setUsername("security_admin"); admin.setEmail("security_admin@example.test");
        admin.setPasswordHash(passwords.encode("correct-horse")); admin.setAccountStatus("ACTIVE");
        admin.setDesignation("Administrator"); admin.setHireDate(LocalDate.now()); admin.setAdminLevel("LEVEL_1");
        admin = administrators.saveAndFlush(admin);

        viewer = new RegisteredViewer();
        viewer.setUsername("security_viewer"); viewer.setEmail("security_viewer@example.test");
        viewer.setPasswordHash(passwords.encode("correct-horse")); viewer.setAccountStatus("ACTIVE");
        viewer.setPreferredLanguage("en"); viewer.setIsPremium(false); viewer.setNotifyChannel("EMAIL");
        viewer = viewers.saveAndFlush(viewer);
    }

    @Test
    void adminApiRequiresAdministrator() throws Exception {
        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + tokens.issue(viewer.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }

    @Test
    void loginReturnsSignedTokenAndMeUsesOnlyPrincipal() throws Exception {
        String body = json.writeValueAsString(java.util.Map.of("identifier", viewer.getEmail(), "password", "correct-horse"));
        String token = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();
        mvc.perform(get("/api/auth/me").param("userId", admin.getId().toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value(viewer.getUsername()));
    }

    @Test
    void passwordsAreBcryptAndPlaintextFallbackIsRejected() throws Exception {
        assertThat(viewer.getPasswordHash()).startsWith("$2");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("identifier", viewer.getEmail(), "password", viewer.getPasswordHash()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidStatusIsRejected() throws Exception {
        mvc.perform(patch("/api/admin/users/" + viewer.getId() + "/status")
                        .header("Authorization", "Bearer " + tokens.issue(admin.getId()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DEACTIVATED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminMutationRecordsAuthenticatedActorAndTarget() throws Exception {
        mvc.perform(patch("/api/admin/users/" + viewer.getId() + "/status")
                        .header("Authorization", "Bearer " + tokens.issue(admin.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SUSPENDED\",\"reason\":\"Policy review\"}"))
                .andExpect(status().isOk());

        ActivityLog log = activityLogs.findAllByOrderByActionTimeDesc().stream()
                .filter(candidate -> "ACCOUNT_STATUS_CHANGED".equals(candidate.getActionType()))
                .findFirst().orElseThrow();
        assertThat(log.getActor().getId()).isEqualTo(admin.getId());
        assertThat(log.getTargetUser().getId()).isEqualTo(viewer.getId());
        assertThat(log.getDetail()).contains("Policy review");

        mvc.perform(get("/api/admin/users/activity-logs")
                        .param("userId", viewer.getId().toString())
                        .header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].actorUserId").value(admin.getId()))
                .andExpect(jsonPath("$[0].targetUserId").value(viewer.getId()))
                .andExpect(jsonPath("$[0].detail").value(org.hamcrest.Matchers.containsString("Policy review")));
    }
}
