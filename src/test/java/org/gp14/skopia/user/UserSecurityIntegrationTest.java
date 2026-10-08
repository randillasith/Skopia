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
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
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
    // CI has no deployment receipt; public access must not depend on the VPS marker.
    private static final String MISSING_DEPLOYMENT_MARKER =
            System.getProperty("java.io.tmpdir") + "/skopia-security-unwritten-" + java.util.UUID.randomUUID();

    @DynamicPropertySource
    static void deploymentReceipt(DynamicPropertyRegistry registry) {
        registry.add("skopia.deployment.sha-file", () -> MISSING_DEPLOYMENT_MARKER);
    }

    @Autowired MockMvc mvc;
    ObjectMapper json = new ObjectMapper();
    @Autowired AdministratorRepository administrators;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired PasswordService passwords;
    @Autowired TokenService tokens;
    @Autowired ActivityLogRepository activityLogs;
    Administrator admin;
    RegisteredViewer viewer;
    RegisteredViewer otherViewer;

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

        otherViewer = new RegisteredViewer();
        otherViewer.setUsername("other_viewer"); otherViewer.setEmail("other_viewer@example.test");
        otherViewer.setPasswordHash(passwords.encode("another-horse")); otherViewer.setAccountStatus("ACTIVE");
        otherViewer.setPreferredLanguage("en"); otherViewer.setIsPremium(false); otherViewer.setNotifyChannel("EMAIL");
        otherViewer = viewers.saveAndFlush(otherViewer);
    }

    @Test
    void adminApiRequiresAdministrator() throws Exception {
        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + tokens.issue(viewer.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].passwordHash").doesNotExist());
        mvc.perform(get("/api/billing/admin/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/billing/admin/users").header("Authorization", "Bearer " + tokens.issue(viewer.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/billing/admin/users").header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.username == 'security_viewer')].status").value("FREE"));
    }

    @Test
    void registeredViewerNamedAdminCannotAcquireStaffPrivileges() throws Exception {
        String body = json.writeValueAsString(java.util.Map.of("username", "admin", "email", "admin-viewer@example.test", "password", "viewer-password"));
        String registration = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String viewerToken = json.readTree(registration).get("token").asText();
        for (String path : java.util.List.of("/api/admin/users", "/api/billing/admin/users")) {
            mvc.perform(get(path).header("Authorization", "Bearer " + viewerToken)).andExpect(status().isForbidden());
            mvc.perform(get(path).header("Authorization", "Bearer " + tokens.issue(admin.getId()))).andExpect(status().isOk());
        }
    }

    @Test
    void renamedViewerNamedAdminCannotAcquireStaffPrivileges() throws Exception {
        viewer.setUsername("AdMiN");
        viewers.saveAndFlush(viewer);
        for (String path : java.util.List.of("/api/admin/users", "/api/billing/admin/users")) {
            mvc.perform(get(path).header("Authorization", "Bearer " + tokens.issue(viewer.getId())))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void announcementAdminAliasRequiresAdministrator() throws Exception {
        mvc.perform(get("/api/announcements/admin")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/announcements/admin").header("Authorization", "Bearer " + tokens.issue(viewer.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/announcements/admin").header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk());
    }

    @Test
    void unmatchedApiPathsDenyAnonymousAndAuthenticatedCallers() throws Exception {
        mvc.perform(get("/api/not-yet-registered")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/not-yet-registered").header("Authorization", "Bearer " + tokens.issue(viewer.getId())))
                .andExpect(status().isForbidden());
    }

    @Test
    void intendedPublicReadsRemainPublic() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk());
        mvc.perform(get("/api/categories")).andExpect(status().isOk());
        // The route is public, but without a deployed-main receipt it correctly reports unknown.
        mvc.perform(get("/api/deployment")).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("deployment unknown"));
        // A nonexistent video is rejected by the endpoint, not by security.
        mvc.perform(get("/api/ads/active").param("videoId", "999999")).andExpect(status().isNotFound());
    }

    @Test
    void profileAndAdminBadgesIgnoreStaleLegacyPremiumFlag() throws Exception {
        viewer.setIsPremium(true); viewers.saveAndFlush(viewer);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tokens.issue(viewer.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isPremium").value(false));
        mvc.perform(get("/api/admin/users/" + viewer.getId())
                .header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isPremium").value(false));
        mvc.perform(get("/api/admin/users/stats")
                .header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.premiumViewers").value(0));
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

    @Test
    void nonAdminCannotModerateVideo() throws Exception {
        mvc.perform(patch("/api/admin/videos/999/status")
                        .header("Authorization", "Bearer " + tokens.issue(viewer.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\",\"reason\":\"Policy review\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void publicVideoReadsStayPublicButMutationsAndPrivateShelfRequireAuthentication() throws Exception {
        mvc.perform(get("/api/videos")).andExpect(status().isOk());
        mvc.perform(get("/api/history").header("X-User-Id", viewer.getId()))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/watchlist").header("X-User-Id", viewer.getId()))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/videos").param("scope", "mine").header("X-User-Id", viewer.getId()))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/videos/999")
                        .header("X-User-Id", viewer.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reportsUseBearerOwnerAndComplaintQueueRequiresStaff() throws Exception {
        String report = mvc.perform(post("/api/reports")
                        .header("Authorization", "Bearer " + tokens.issue(viewer.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"viewerId\":" + otherViewer.getId() + ",\"type\":\"OTHER\",\"details\":\"Owner check\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.viewerId").value(viewer.getId()))
                .andReturn().getResponse().getContentAsString();
        long reportId = json.readTree(report).get("id").asLong();

        mvc.perform(get("/api/reports/" + reportId)
                        .header("Authorization", "Bearer " + tokens.issue(otherViewer.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/complaints/queue")
                        .header("Authorization", "Bearer " + tokens.issue(viewer.getId())))
                .andExpect(status().isForbidden());
    }

    @Test
    void selfServiceProfileAlwaysUsesBearerPrincipal() throws Exception {
        mvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + tokens.issue(viewer.getId()))
                        .header("X-User-Id", otherViewer.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Changed by owner\",\"email\":\"changed@example.test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(viewer.getId()))
                .andExpect(jsonPath("$.email").value("changed@example.test"));

        assertThat(viewers.findById(otherViewer.getId()).orElseThrow().getEmail())
                .isEqualTo("other_viewer@example.test");

        mvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + tokens.issue(viewer.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void selfServiceDeactivationCannotTargetAnotherUserOrDeleteData() throws Exception {
        mvc.perform(delete("/api/users/me")
                        .header("Authorization", "Bearer " + tokens.issue(viewer.getId()))
                        .header("X-User-Id", otherViewer.getId()))
                .andExpect(status().isNoContent());

        assertThat(viewers.findById(viewer.getId()).orElseThrow().getAccountStatus()).isEqualTo("DEACTIVATED");
        assertThat(viewers.existsById(otherViewer.getId())).isTrue();
    }
}
