package org.gp14.skopia.report;

import org.gp14.skopia.complaint.ComplaintRepository;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.AdministratorRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

    @Test
    void submittedVideoReportImmediatelyAppearsInAdminModerationQueueAndCanBeResolved() throws Exception {
        RegisteredViewer viewer = viewer("reporter");
        Administrator admin = admin("admin");

        String body = """
                {"type":"INAPPROPRIATE_CONTENT","details":"This video contains abusive content.","contentReference":"video:77"}
                """;

        String response = mvc.perform(post("/api/reports")
                        .header("Authorization", "Bearer " + tokens.issue(viewer.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.viewerId").value(viewer.getId()))
                .andExpect(jsonPath("$.contentReference").value("video:77"))
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
}
