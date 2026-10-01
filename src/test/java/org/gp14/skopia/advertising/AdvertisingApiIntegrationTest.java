package org.gp14.skopia.advertising;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * FR5 over HTTP, as the frontend actually calls it.
 *
 * <p>{@link #theWholeJourney()} is the one that matters: it walks every user story
 * in FR5 in order — upload creative, create a campaign, schedule it, assign it to a
 * category, confirm it, have it served to a viewer, record a click, and read the
 * performance back — because each of those passing in isolation still leaves the
 * question of whether they fit together.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdvertisingApiIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AdvertisingFixture fixture;
    @Autowired org.gp14.skopia.security.TokenService tokens;

    /**
     * The test's own reader. Spring Boot 4 does not publish a Jackson 2
     * {@code ObjectMapper} bean, and nothing here needs the application's
     * configuration anyway — these assertions only read what came back.
     */
    private final ObjectMapper json = new ObjectMapper();

    private String officer;
    private Category documentary;
    private Video longExposure;

    @BeforeEach
    void setUp() {
        officer = "Bearer " + tokens.issue(fixture.officer().getId());
        documentary = fixture.category("Documentary");
        longExposure = fixture.video("The Long Exposure", documentary);
    }

    @Test
    @DisplayName("the whole FR5 journey, end to end")
    void theWholeJourney() throws Exception {
        LocalDateTime start = LocalDateTime.now().minusDays(1);
        LocalDateTime end = LocalDateTime.now().plusDays(30);

        /* 1. "I want to upload advertisement content such as video, images and links" */
        JsonNode uploaded = body(mvc.perform(multipart("/api/advertisements/media")
                        .file(new MockMultipartFile("file", "trailer.mp4", "video/mp4", new byte[] { 1, 2 }))
                        .header("Authorization", officer))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(uploaded.get("adType").asText()).isEqualTo("VIDEO");
        String mediaUrl = uploaded.get("mediaUrl").asText();

        /* 2. "I want to create and schedule ad campaigns" */
        JsonNode campaign = body(mvc.perform(post("/api/ad-campaigns")
                        .header("Authorization", officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"campaignName":"Autumn Season Launch","advertiser":"Meridian Films",
                                 "startDate":"%s","endDate":"%s","budget":2500.00}
                                """.formatted(start, end)))
                .andExpect(status().isCreated())
                .andReturn());
        long campaignId = campaign.get("id").asLong();
        assertThat(campaign.get("status").asText()).isEqualTo("DRAFT");

        JsonNode ad = body(mvc.perform(post("/api/advertisements")
                        .header("Authorization", officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"campaignId":%d,"adTitle":"Autumn trailer","mediaUrl":"%s",
                                 "adType":"VIDEO","adDuration":20,
                                 "clickUrl":"https://example.invalid/autumn"}
                                """.formatted(campaignId, mediaUrl)))
                .andExpect(status().isCreated())
                .andReturn());
        long adId = ad.get("id").asLong();

        /* 3. "I want to assign advertisements to selected videos or video categories" */
        JsonNode options = body(mvc.perform(get("/api/advertisements/target-options")
                        .header("Authorization", officer))
                .andExpect(status().isOk()).andReturn());
        assertThat(options.get("categories")).isNotEmpty();
        assertThat(options.get("videos")).isNotEmpty();

        mvc.perform(post("/api/advertisements/{id}/targets", adId)
                        .header("Authorization", officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":%d,"slotPosition":"PREROLL","priority":1}
                                """.formatted(documentary.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetKind").value("category"))
                .andExpect(jsonPath("$.targetLabel").value("Documentary"));

        mvc.perform(post("/api/advertisements/{id}/activate", adId)
                        .header("Authorization", officer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        mvc.perform(post("/api/ad-campaigns/{id}/confirm", campaignId)
                        .header("Authorization", officer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        /* 4. A viewer plays the title, and the advertisement is delivered. */
        JsonNode served = body(mvc.perform(get("/api/ads/active")
                        .param("videoId", String.valueOf(longExposure.getId()))
                        .param("slot", "PREROLL")
                        .param("device", "desktop"))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(served).hasSize(1);
        JsonNode slot = served.get(0);
        assertThat(slot.get("label").asText()).isEqualTo("Advertisement");
        assertThat(slot.get("adTitle").asText()).isEqualTo("Autumn trailer");
        long impressionId = slot.get("impressionId").asLong();
        assertThat(slot.get("clickUrl").asText()).isEqualTo("/api/ads/click/" + impressionId);

        /* 5. The viewer clicks, and is redirected to the advertiser. */
        mvc.perform(get("/api/ads/click/{id}", impressionId))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://example.invalid/autumn"));

        /* 6. "I want to monitor ad performance metrics" */
        LocalDate today = LocalDate.now();
        mvc.perform(get("/api/ad-campaigns/{id}/metrics", campaignId)
                        .header("Authorization", officer)
                        .param("from", today.toString()).param("to", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.impressions").value(1))
                .andExpect(jsonPath("$.clicks").value(1))
                .andExpect(jsonPath("$.ctr").value(100.0));

        MvcResult csv = mvc.perform(get("/api/ad-campaigns/{id}/metrics.csv", campaignId)
                        .header("Authorization", officer))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"campaign-" + campaignId + "-performance.csv\""))
                .andReturn();
        assertThat(csv.getResponse().getContentAsString()).contains("Impressions,1");
    }

    /* ----------------------------------------------------------------- RBAC */

    @Test
    @DisplayName("management endpoints refuse an unidentified caller and a non-staff one")
    void guardsTheManagementEndpoints() throws Exception {
        mvc.perform(get("/api/ad-campaigns")).andExpect(status().isUnauthorized());

        // A real account with a real token, but not one that holds advertising.
        // Refused by the filter chain, which answers before the controller runs.
        mvc.perform(get("/api/ad-campaigns")
                        .header("Authorization", "Bearer " + tokens.issue(fixture.viewer().getId())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("a forged X-User-Id header buys nothing — the header is not read any more")
    void refusesAForgedActorHeader() throws Exception {
        // The regression guard for the hole this module shipped with: every
        // management endpoint took the caller's id from a request header, so
        // `X-User-Id: 1` was enough to create campaigns in a marketing officer's
        // name. Other parts of the platform still send the header, so this asserts
        // it is ignored rather than that it is absent.
        mvc.perform(post("/api/ad-campaigns")
                        .header("X-User-Id", fixture.officer().getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(campaignBody("Forged")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a tampered or unparseable token is refused")
    void refusesABadToken() throws Exception {
        mvc.perform(get("/api/ad-campaigns").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());

        String valid = tokens.issue(fixture.officer().getId());
        // Flip the last character of the signature. HMAC means this cannot verify.
        String tampered = valid.substring(0, valid.length() - 1) + (valid.endsWith("A") ? "B" : "A");
        mvc.perform(get("/api/ad-campaigns").header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("one officer cannot change another officer's campaign")
    void refusesAColleaguesCampaign() throws Exception {
        String id = json.readTree(mvc.perform(post("/api/ad-campaigns")
                        .header("Authorization", officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(campaignBody("Ours")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asText();

        String colleague = "Bearer " + tokens.issue(fixture.officer().getId());

        // Reading is shared: the console shows one list and that is useful.
        mvc.perform(get("/api/ad-campaigns/" + id).header("Authorization", colleague))
                .andExpect(status().isOk());

        // Changing it is not.
        mvc.perform(delete("/api/ad-campaigns/" + id).header("Authorization", colleague))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("another marketing officer")));

        mvc.perform(put("/api/ad-campaigns/" + id)
                        .header("Authorization", colleague)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(campaignBody("Theirs")))
                .andExpect(status().isForbidden());

        // The officer who booked it still can.
        mvc.perform(delete("/api/ad-campaigns/" + id).header("Authorization", officer))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("an administrator can act on a campaign they did not book")
    void letsAnAdministratorClearUp() throws Exception {
        String id = json.readTree(mvc.perform(post("/api/ad-campaigns")
                        .header("Authorization", officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(campaignBody("Left behind")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asText();

        mvc.perform(delete("/api/ad-campaigns/" + id)
                        .header("Authorization", "Bearer " + tokens.issue(fixture.administrator().getId())))
                .andExpect(status().isNoContent());
    }

    private static String campaignBody(String name) {
        return "{\"campaignName\":\"" + name + "\",\"advertiser\":\"Anyone\","
                + "\"startDate\":\"2026-01-01T00:00:00\",\"endDate\":\"2027-01-01T00:00:00\",\"budget\":1}";
    }

    @Test
    @DisplayName("serving and click tracking stay open, because viewers are the ones calling them")
    void leavesTheViewerPathOpen() throws Exception {
        mvc.perform(get("/api/ads/active").param("videoId", String.valueOf(longExposure.getId())))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    /* ----------------------------------------------------------- validation */

    @Test
    @DisplayName("a form error comes back per field, so the UI can put it under the input")
    void reportsValidationPerField() throws Exception {
        mvc.perform(post("/api/ad-campaigns")
                        .header("Authorization", officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"campaignName":"","advertiser":"Meridian Films"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.campaignName").exists())
                .andExpect(jsonPath("$.fields.startDate").exists())
                .andExpect(jsonPath("$.fields.endDate").exists());
    }

    @Test
    @DisplayName("an impossible window is refused with the reason the form shows")
    void refusesABackwardsWindow() throws Exception {
        LocalDateTime start = LocalDateTime.now().plusDays(10);
        mvc.perform(post("/api/ad-campaigns")
                        .header("Authorization", officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"campaignName":"Backwards","startDate":"%s","endDate":"%s"}
                                """.formatted(start, start.minusDays(1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "The end date must fall after the start date."));
    }

    @Test
    @DisplayName("asking for a campaign that does not exist is a 404")
    void missingCampaignIs404() throws Exception {
        mvc.perform(get("/api/ad-campaigns/{id}", 999_999)
                        .header("Authorization", officer))
                .andExpect(status().isNotFound());
    }

    private JsonNode body(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString());
    }
}
