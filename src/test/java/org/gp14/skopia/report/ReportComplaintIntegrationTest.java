package org.gp14.skopia.report;

import org.gp14.skopia.complaint.ComplaintRepository;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.AdministratorRepository;
import org.gp14.skopia.repository.ContentCreatorRepository;
import org.gp14.skopia.repository.NotificationRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.repository.VideoRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ReportComplaintIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired TokenService tokens;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired AdministratorRepository administrators;
    @Autowired ComplaintRepository complaints;
    @Autowired ContentCreatorRepository creators;
    @Autowired VideoRepository videos;
    @Autowired NotificationRepository notifications;

    @Test
    void submittedVideoReportImmediatelyAppearsInAdminModerationQueueAndCanBeResolved() throws Exception {
        RegisteredViewer viewer = viewer("reporter");
        Administrator admin = admin("admin");
        ContentCreator creator = creator("creator");
        Video video = video(creator, "Reported Training Video");

        String body = """
                {"type":"INAPPROPRIATE_CONTENT","details":"This video contains abusive content.","contentReference":"video:%d"}
                """.formatted(video.getId());

        String response = mvc.perform(post("/api/reports")
                        .header("Authorization", "Bearer " + tokens.issue(viewer.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.viewerId").value(viewer.getId()))
                .andExpect(jsonPath("$.contentReference").value("video:" + video.getId()))
                .andReturn().getResponse().getContentAsString();

        long reportId = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("id").asLong();
        assertThat(complaints.findByReportingViewerId(viewer.getId()))
                .singleElement()
                .satisfies(complaint -> assertThat(complaint.getReportId()).isEqualTo(reportId));

        String queue = mvc.perform(get("/api/complaints/queue")
                        .header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].reportId").value(reportId))
                .andReturn().getResponse().getContentAsString();
        long complaintId = new com.fasterxml.jackson.databind.ObjectMapper().readTree(queue).get(0).get("id").asLong();

        mvc.perform(get("/api/reports/" + reportId)
                        .header("Authorization", "Bearer " + tokens.issue(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.details").value("This video contains abusive content."));

        mvc.perform(post("/api/complaints/" + complaintId + "/resolve")
                        .header("Authorization", "Bearer " + tokens.issue(admin.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resolutionNotes\":\"Pulled the reported title after review.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));

        mvc.perform(patch("/api/admin/videos/" + video.getId() + "/status")
                        .header("Authorization", "Bearer " + tokens.issue(admin.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\",\"reason\":\"Complaint upheld\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"));

        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(viewer.getId()))
                .anySatisfy(notification -> {
                    assertThat(notification.getNotifType()).isEqualTo("VIDEO_TAKEN_DOWN");
                    assertThat(notification.getTitle()).contains("Reported Training Video");
                    assertThat(notification.getMessage()).contains("reported").contains("taken down");
                    assertThat(notification.getDedupeKey()).isEqualTo("VIDEO_TAKEN_DOWN:" + video.getId());
                });
    }

    private RegisteredViewer viewer(String prefix) {
        RegisteredViewer viewer = new RegisteredViewer();
        viewer.setUsername(prefix + "_" + UUID.randomUUID());
        viewer.setEmail(UUID.randomUUID() + "@example.test");
        viewer.setPasswordHash("hash");
        viewer.setDisplayName(prefix);
        viewer.setIsPremium(false);
        return viewers.saveAndFlush(viewer);
    }

    private Administrator admin(String prefix) {
        Administrator admin = new Administrator();
        admin.setUsername(prefix + "_" + UUID.randomUUID());
        admin.setEmail(UUID.randomUUID() + "@example.test");
        admin.setPasswordHash("hash");
        admin.setDesignation("Test administrator");
        admin.setHireDate(LocalDate.now());
        admin.setAdminLevel("SUPER");
        return administrators.saveAndFlush(admin);
    }

    private ContentCreator creator(String prefix) {
        ContentCreator creator = new ContentCreator();
        creator.setUsername(prefix + "_" + UUID.randomUUID());
        creator.setEmail(UUID.randomUUID() + "@example.test");
        creator.setPasswordHash("hash");
        creator.setChannelName(prefix + " channel");
        return creators.saveAndFlush(creator);
    }

    private Video video(ContentCreator creator, String title) {
        Video video = new Video();
        video.setCreator(creator);
        video.setTitle(title);
        video.setDescription("Report test video");
        video.setDuration(10);
        video.setVideoStatus("PUBLISHED");
        video.setVideoUrl("https://example.test/" + UUID.randomUUID() + ".mp4");
        return videos.saveAndFlush(video);
    }
}
