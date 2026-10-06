package org.gp14.skopia.notification;

import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.AdministratorRepository;
import org.gp14.skopia.repository.ContentCreatorRepository;
import org.gp14.skopia.repository.NotificationRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
class AnnouncementApiTest {
    @Autowired MockMvc mvc;
    @Autowired AdministratorRepository administrators;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired ContentCreatorRepository creators;
    @Autowired NotificationRepository notifications;
    @Autowired TokenService tokens;

    private Administrator admin(String name) {
        Administrator admin = new Administrator();
        admin.setUsername(name);
        admin.setEmail(name + "@example.test");
        admin.setPasswordHash("test-only-hash");
        admin.setDesignation("Administrator");
        admin.setHireDate(LocalDate.of(2024, 1, 1));
        admin.setAdminLevel("PLATFORM");
        return administrators.saveAndFlush(admin);
    }

    private RegisteredViewer viewer(String name) {
        RegisteredViewer viewer = new RegisteredViewer();
        viewer.setUsername(name);
        viewer.setEmail(name + "@example.test");
        viewer.setPasswordHash("test-only-hash");
        return viewers.saveAndFlush(viewer);
    }

    private ContentCreator creator(String name) {
        ContentCreator creator = new ContentCreator();
        creator.setUsername(name);
        creator.setEmail(name + "@example.test");
        creator.setPasswordHash("test-only-hash");
        creator.setChannelName(name + " channel");
        return creators.saveAndFlush(creator);
    }

    private String bearer(org.gp14.skopia.model.user.User user) {
        return "Bearer " + tokens.issue(user.getId());
    }

    @Test
    void adminDraftEditPublishArchiveLifecycleIsRoleProtectedAndTerminal() throws Exception {
        Administrator admin = admin("announcementAdmin");
        RegisteredViewer viewer = viewer("announcementViewer");
        String draft = "{\"title\":\"Maintenance\",\"body\":\"Initial details\",\"audience\":\"ALL\"}";

        mvc.perform(post("/api/admin/announcements").header("Authorization", bearer(viewer))
                        .contentType(MediaType.APPLICATION_JSON).content(draft))
                .andExpect(status().isForbidden());
        String response = mvc.perform(post("/api/admin/announcements").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(draft))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn().getResponse().getContentAsString();
        long id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("id").asLong();

        mvc.perform(put("/api/admin/announcements/" + id).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Maintenance update\",\"body\":\"Final details\",\"audience\":\"VIEWERS\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Maintenance update"));
        mvc.perform(get("/api/announcements").header("Authorization", bearer(viewer)))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(post("/api/admin/announcements/" + id + "/publish").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.publishDate").exists());
        mvc.perform(put("/api/admin/announcements/" + id).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(draft))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/admin/announcements/" + id + "/archive").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ARCHIVED"));
        mvc.perform(post("/api/admin/announcements/" + id + "/publish").header("Authorization", bearer(admin)))
                .andExpect(status().isConflict());
    }

    @Test
    void authenticatedUsersSeeOnlyPublishedApplicableAudienceWithoutNotificationFanout() throws Exception {
        Administrator admin = admin("audienceAdmin");
        RegisteredViewer viewer = viewer("audienceViewer");
        ContentCreator creator = creator("audienceCreator");
        createAndPublish(admin, "Everyone", "ALL");
        createAndPublish(admin, "Viewer only", "VIEWERS");
        createAndPublish(admin, "Creator only", "CREATORS");

        mvc.perform(get("/api/announcements")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/announcements").header("Authorization", bearer(viewer)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].title").value(org.hamcrest.Matchers.containsInAnyOrder("Everyone", "Viewer only")));
        mvc.perform(get("/api/announcements").header("Authorization", bearer(creator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].title").value(org.hamcrest.Matchers.containsInAnyOrder("Everyone", "Creator only")));
        assertThat(notifications.count()).isZero();
    }

    @Test
    void validatesAnnouncementAudienceAndBounds() throws Exception {
        Administrator admin = admin("validationAdmin");
        mvc.perform(post("/api/admin/announcements").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Bad\",\"body\":\"Body\",\"audience\":\"STAFF\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/announcements").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\",\"body\":\"Body\",\"audience\":\"ALL\"}"))
                .andExpect(status().isBadRequest());
    }

    private void createAndPublish(Administrator admin, String title, String audience) throws Exception {
        String response = mvc.perform(post("/api/admin/announcements").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"body\":\"Body\",\"audience\":\"" + audience + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("id").asLong();
        mvc.perform(post("/api/admin/announcements/" + id + "/publish").header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
    }
}
