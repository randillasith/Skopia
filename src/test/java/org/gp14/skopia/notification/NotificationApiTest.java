package org.gp14.skopia.notification;

import org.gp14.skopia.model.notification.Notification;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.*;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class NotificationApiTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired ContentCreatorRepository creators;
    @Autowired AdministratorRepository administrators;
    @Autowired NotificationRepository notifications;
    @Autowired VideoRepository videos;
    @Autowired TokenService tokens;
    @Autowired NotificationService notificationService;

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

    private Administrator administrator(String name) {
        Administrator admin = new Administrator();
        admin.setUsername(name);
        admin.setEmail(name + "@example.test");
        admin.setPasswordHash("test-only-hash");
        admin.setDesignation("Test administrator");
        admin.setHireDate(java.time.LocalDate.now());
        admin.setAdminLevel("SUPER");
        return administrators.saveAndFlush(admin);
    }

    private String bearer(org.gp14.skopia.model.user.User user) {
        return "Bearer " + tokens.issue(user.getId());
    }

    @Test
    void videoCreationNotifiesActiveViewersExcludingCreatorAndDedupesRetries() throws Exception {
        ContentCreator creator = creator("noticeCreator");
        RegisteredViewer first = viewer("noticeFirst");
        RegisteredViewer second = viewer("noticeSecond");
        Administrator admin = administrator("noticeAdmin");
        RegisteredViewer suspended = viewer("noticeSuspended");
        suspended.setAccountStatus("SUSPENDED");
        viewers.saveAndFlush(suspended);

        mvc.perform(post("/api/videos").header("Authorization", bearer(creator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"New release\",\"description\":\"Body\","
                                + "\"videoUrl\":\"https://example.test/video.mp4\",\"status\":\"PUBLISHED\"}"))
                .andExpect(status().isCreated());

        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(first.getId())).hasSize(1);
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(second.getId())).hasSize(1);
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(admin.getId())).hasSize(1);
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(creator.getId())).isEmpty();
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(suspended.getId())).isEmpty();
        Video video = videos.findAll().stream().filter(v -> "New release".equals(v.getTitle())).findFirst().orElseThrow();
        notificationService.notifyVideoCreated(video);
        notificationService.notifyVideoCreated(video);
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(first.getId())).hasSize(1);

        mvc.perform(get("/api/notifications").header("Authorization", bearer(first)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("New video: New release"))
                .andExpect(jsonPath("$[0].body").exists())
                .andExpect(jsonPath("$[0].type").value("VIDEO_CREATED"))
                .andExpect(jsonPath("$[0].link").value("/watch/" + video.getId()))
                .andExpect(jsonPath("$[0].readAt").doesNotExist());
    }

    @Test
    void listCountAndReadOperationsAreAuthenticatedAndOwnershipSafe() throws Exception {
        RegisteredViewer owner = viewer("noticeOwner");
        RegisteredViewer other = viewer("noticeOther");
        Notification first = notificationService.create(owner, "One", "Body", "SYSTEM", "/one", "one");
        notificationService.create(owner, "Two", "Body", "SYSTEM", "/two", "two");

        mvc.perform(get("/api/notifications")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));
        mvc.perform(post("/api/notifications/" + first.getId() + "/read").header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/notifications/" + first.getId() + "/read").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.readAt").exists());
        mvc.perform(post("/api/notifications/read-all").header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void failedVideoCreationCreatesNoNotification() throws Exception {
        ContentCreator creator = creator("failedCreator");
        RegisteredViewer viewer = viewer("failedAudience");
        mvc.perform(post("/api/videos").header("Authorization", bearer(creator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Broken\",\"videoUrl\":\"file:///etc/passwd\"}"))
                .andExpect(status().isBadRequest());
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(viewer.getId())).isEmpty();
    }
}
