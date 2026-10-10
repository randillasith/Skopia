package org.gp14.skopia.video;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.gp14.skopia.billing.BillingService;
import org.gp14.skopia.model.user.*;
import org.gp14.skopia.model.video.*;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.UUID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {"skopia.billing.demo-enabled=true", "skopia.billing.legacy-orders-enabled=true"})
@Transactional
class VideoSecurityIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired VideoRepository videos;
    @Autowired ContentCreatorRepository creators;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired AdministratorRepository administrators;
    @Autowired AccessTierRepository tiers;
    @Autowired TokenService tokens;
    @Autowired BillingService billing;
    @Autowired CategoryRepository categories;
    ObjectMapper json = new ObjectMapper();

    @Test void signedPrivateRangeRevokedWhenCreatorDeactivated() throws Exception {
        ContentCreator owner = new ContentCreator();
        owner.setUsername("owner_" + UUID.randomUUID()); owner.setEmail(UUID.randomUUID() + "@example.test");
        owner.setPasswordHash("hash"); owner.setChannelName("Channel");
        owner = creators.saveAndFlush(owner);
        String filename = UUID.randomUUID() + ".mp4";
        Path file = Path.of("uploads", filename);
        Files.createDirectories(file.getParent()); Files.write(file, new byte[]{1,2,3,4});
        try {
            Video draft = video(owner, null, "DRAFT", "/uploads/" + filename);
            String response = mvc.perform(get("/api/videos/" + draft.getId())
                    .header("Authorization", "Bearer " + tokens.issue(owner.getId())))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            String signed = json.readTree(response).get("videoUrl").asText();
            mvc.perform(get(signed).header("Range", "bytes=1-2"))
                    .andExpect(status().isPartialContent()).andExpect(content().bytes(new byte[]{2,3}));
            owner.setAccountStatus("SUSPENDED"); creators.saveAndFlush(owner);
            mvc.perform(get(signed).header("Range", "bytes=1-2")).andExpect(status().isForbidden());
            mvc.perform(get("/uploads/" + filename).header("Authorization", "Bearer " + tokens.issue(owner.getId())))
                    .andExpect(status().isForbidden());
        } finally { Files.deleteIfExists(file); }
    }

    @Test void mineSearchRespectsAllFiltersAndPublicSearchDoesNotLeakOtherStatuses() throws Exception {
        ContentCreator owner = new ContentCreator(); owner.setUsername("owner_" + UUID.randomUUID());
        owner.setEmail(UUID.randomUUID() + "@example.test"); owner.setPasswordHash("hash"); owner.setChannelName("Channel");
        owner = creators.saveAndFlush(owner);
        AccessTier free = new AccessTier(); free.setTierName("FREE"); free = tiers.saveAndFlush(free);
        AccessTier premium = new AccessTier(); premium.setTierName("PREMIUM"); premium = tiers.saveAndFlush(premium);
        org.gp14.skopia.model.video.Category category = new org.gp14.skopia.model.video.Category();
        category.setCategoryName("Unique " + UUID.randomUUID());
        category = categories.saveAndFlush(category);
        Video match = video(owner, free, "DRAFT", "https://example.test/one.mp4");
        match.setTitle("needle-specific"); match.setCategory(category); videos.saveAndFlush(match);
        Video wrongTier = video(owner, premium, "DRAFT", "https://example.test/two.mp4");
        wrongTier.setTitle("needle-specific"); wrongTier.setCategory(category); videos.saveAndFlush(wrongTier);
        Video wrongCategory = video(owner, free, "DRAFT", "https://example.test/three.mp4");
        wrongCategory.setTitle("needle-specific"); videos.saveAndFlush(wrongCategory);
        String result = mvc.perform(get("/api/videos").header("Authorization", "Bearer " + tokens.issue(owner.getId()))
                .param("scope", "mine").param("search", "needle-specific")
                .param("category", category.getId().toString()).param("access", "FREE"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(result).size()).isEqualTo(1);
        assertThat(json.readTree(result).get(0).get("id").asLong()).isEqualTo(match.getId());
        String publicResult = mvc.perform(get("/api/videos").param("search", "needle-specific"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(publicResult).size()).isZero();
    }

    @Test void repeatedViewPostsBySameViewerAreDeduplicated() throws Exception {
        ContentCreator owner = new ContentCreator(); owner.setUsername("owner_" + UUID.randomUUID());
        owner.setEmail(UUID.randomUUID() + "@example.test"); owner.setPasswordHash("hash"); owner.setChannelName("Channel");
        owner = creators.saveAndFlush(owner);
        RegisteredViewer a = viewer("viewer", false), b = viewer("viewer", false);
        Video v = video(owner, null, "PUBLISHED", "https://example.test/view.mp4");
        for (int i = 0; i < 5; i++) mvc.perform(post("/api/videos/" + v.getId() + "/view")
                .header("Authorization", "Bearer " + tokens.issue(a.getId()))).andExpect(status().isOk());
        mvc.perform(post("/api/videos/" + v.getId() + "/view")
                .header("Authorization", "Bearer " + tokens.issue(b.getId()))).andExpect(status().isOk());
        assertThat(videos.findById(v.getId()).orElseThrow().getViewCount()).isEqualTo(2);
    }

    @Test void anonymousCookieLessViewPostsCannotInflateCounts() throws Exception {
        ContentCreator owner = new ContentCreator(); owner.setUsername("owner_" + UUID.randomUUID());
        owner.setEmail(UUID.randomUUID() + "@example.test"); owner.setPasswordHash("hash"); owner.setChannelName("Channel");
        owner = creators.saveAndFlush(owner);
        Video v = video(owner, null, "PUBLISHED", "https://example.test/free.mp4");
        for (int i = 0; i < 3; i++) mvc.perform(post("/api/videos/" + v.getId() + "/view"))
                .andExpect(status().isUnauthorized());
        assertThat(videos.findById(v.getId()).orElseThrow().getViewCount()).isZero();
    }

    @Test void creatorsAndAdministratorsCanParticipateInComments() throws Exception {
        ContentCreator creator = new ContentCreator();
        creator.setUsername("creator_" + UUID.randomUUID());
        creator.setEmail(UUID.randomUUID() + "@example.test");
        creator.setPasswordHash("hash");
        creator.setChannelName("Creator Channel");
        creator = creators.saveAndFlush(creator);
        Video video = video(creator, null, "PUBLISHED", "https://example.test/comments.mp4");

        mvc.perform(post("/api/videos/" + video.getId() + "/comments")
                        .header("Authorization", "Bearer " + tokens.issue(creator.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Creator comment\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(creator.getId()))
                .andExpect(jsonPath("$.displayName").value("Creator Channel"));

        Administrator administrator = new Administrator();
        administrator.setUsername("admin_" + UUID.randomUUID());
        administrator.setEmail(UUID.randomUUID() + "@example.test");
        administrator.setPasswordHash("hash");
        administrator.setFirstName("Comment");
        administrator.setLastName("Administrator");
        administrator.setDesignation("Administrator");
        administrator.setHireDate(LocalDate.now());
        administrator.setAdminLevel("SYSTEM");
        administrator = administrators.saveAndFlush(administrator);

        mvc.perform(post("/api/videos/" + video.getId() + "/comments")
                        .header("Authorization", "Bearer " + tokens.issue(administrator.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Administrator comment\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(administrator.getId()))
                .andExpect(jsonPath("$.displayName").value("Comment Administrator"));
    }

    @Test void commentBadgeFollowsEntitlementNotLegacyFlag() throws Exception {
        ContentCreator owner = new ContentCreator(); owner.setUsername("owner_" + UUID.randomUUID());
        owner.setEmail(UUID.randomUUID() + "@example.test"); owner.setPasswordHash("hash"); owner.setChannelName("Channel");
        owner = creators.saveAndFlush(owner);
        RegisteredViewer stale = viewer("stale", true);
        Video v = video(owner, null, "PUBLISHED", "https://example.test/movie.mp4");
        mvc.perform(post("/api/videos/" + v.getId() + "/comments")
                .header("Authorization", "Bearer " + tokens.issue(stale.getId()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"first\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.badge").value(org.hamcrest.Matchers.nullValue()));
        mvc.perform(get("/api/videos/" + v.getId() + "/comments"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].badge").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test void publicFreePlaybackPremiumAndDraftAreGuardedEvenForRangeRequests() throws Exception {
        ContentCreator creator = new ContentCreator();
        creator.setUsername("video_creator_" + UUID.randomUUID()); creator.setEmail(UUID.randomUUID() + "@example.test");
        creator.setPasswordHash("hash"); creator.setChannelName("Channel");
        creator = creators.saveAndFlush(creator);
        RegisteredViewer paid = viewer("paid", true);
        RegisteredViewer unpaid = viewer("unpaid", false);
        AccessTier premium = new AccessTier(); premium.setTierName("PREMIUM"); premium = tiers.saveAndFlush(premium);
        AccessTier free = new AccessTier(); free.setTierName("FREE"); free = tiers.saveAndFlush(free);
        String filename = UUID.randomUUID() + ".mp4";
        Path path = Path.of("uploads", filename);
        Files.createDirectories(path.getParent()); Files.write(path, new byte[]{0,1,2,3,4,5,6,7});
        try {
            Video freeVideo = video(creator, free, "PUBLISHED", "/uploads/" + filename);
            mvc.perform(get("/api/videos/" + freeVideo.getId())).andExpect(status().isOk())
                    .andExpect(jsonPath("$.videoUrl").value("/uploads/" + filename));
            mvc.perform(get("/uploads/" + filename).header("Range", "bytes=2-4"))
                    .andExpect(status().isPartialContent()).andExpect(content().bytes(new byte[]{2,3,4}));
            // Give each video a distinct path: the guard never serves unreferenced files.
            String paidFile = UUID.randomUUID() + ".mp4";
            Path paidPath = Path.of("uploads", paidFile);
            Files.write(paidPath, new byte[]{0,1,2,3,4,5,6,7});
            try {
                Video protectedVideo = video(creator, premium, "PUBLISHED", "/uploads/" + paidFile);
                mvc.perform(get("/api/videos/" + protectedVideo.getId()))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.videoUrl").value(org.hamcrest.Matchers.nullValue()));
                mvc.perform(get("/api/videos")).andExpect(status().isOk())
                        .andExpect(jsonPath("$[?(@.id == " + protectedVideo.getId() + ")].videoUrl").value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.nullValue())));
                mvc.perform(get("/api/videos/" + protectedVideo.getId())
                        .header("Authorization", "Bearer " + tokens.issue(unpaid.getId())))
                        .andExpect(jsonPath("$.videoUrl").value(org.hamcrest.Matchers.nullValue()));
                mvc.perform(post("/api/billing/orders/card-preview")
                        .header("Authorization", "Bearer " + tokens.issue(paid.getId()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"planName\":\"MONTHLY\",\"brand\":\"VISA\",\"billing\":{\"fullName\":\"Demo Viewer\",\"email\":\"demo@example.test\",\"phone\":\"0771234567\",\"addressLine1\":\"Sample Street\",\"city\":\"Colombo\",\"postalCode\":\"00100\",\"country\":\"LK\"}}"))
                        .andExpect(status().isCreated());
                String response = mvc.perform(get("/api/videos/" + protectedVideo.getId())
                        .header("Authorization", "Bearer " + tokens.issue(paid.getId())))
                        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
                String signedUrl = json.readTree(response).get("videoUrl").asText();
                assertThat(signedUrl).startsWith("/uploads/" + paidFile + "?access=");
                mvc.perform(get(signedUrl).header("Range", "bytes=1-3"))
                        .andExpect(status().isPartialContent()).andExpect(content().bytes(new byte[]{1,2,3}));
                mvc.perform(post("/api/billing/cancel")
                        .header("Authorization", "Bearer " + tokens.issue(paid.getId())))
                        .andExpect(status().isOk());
                mvc.perform(get(signedUrl).header("Range", "bytes=1-3")).andExpect(status().isForbidden());
                Video draft = video(creator, free, "DRAFT", "https://example.test/draft.mp4");
                mvc.perform(get("/api/videos/" + draft.getId())).andExpect(status().isUnauthorized());
                mvc.perform(get("/api/videos/" + draft.getId())
                        .header("Authorization", "Bearer " + tokens.issue(creator.getId())))
                        .andExpect(status().isOk());
            } finally { Files.deleteIfExists(paidPath); }
        } finally { Files.deleteIfExists(path); }
    }

    @Test void creatorVisibilityChangesAreEnforcedByTheApiAndCatalogue() throws Exception {
        ContentCreator owner = new ContentCreator();
        owner.setUsername("owner_" + UUID.randomUUID()); owner.setEmail(UUID.randomUUID() + "@example.test");
        owner.setPasswordHash("hash"); owner.setChannelName("Channel");
        owner = creators.saveAndFlush(owner);
        RegisteredViewer outsider = viewer("outsider", false);
        Video v = video(owner, null, "PUBLISHED", "https://example.test/movie.mp4");
        String ownerToken = "Bearer " + tokens.issue(owner.getId());
        String viewerToken = "Bearer " + tokens.issue(outsider.getId());
        mvc.perform(put("/api/videos/" + v.getId()).header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PRIVATE\"}"))
                .andExpect(status().isOk());
        assertThat(videos.findById(v.getId()).orElseThrow().getVideoStatus()).isEqualTo("DRAFT");
        mvc.perform(get("/api/videos/" + v.getId()).header("Authorization", viewerToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/videos/" + v.getId()).header("Authorization", ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"));
        mvc.perform(put("/api/videos/" + v.getId()).header("Authorization", viewerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PUBLIC\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/videos/" + v.getId()).header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/videos/" + v.getId()).header("Authorization", viewerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"));
        mvc.perform(put("/api/videos/" + v.getId()).header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PULLED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test void forgedIdsCannotCreateOrEditOthersComments() throws Exception {
        RegisteredViewer a = viewer("author", false);
        RegisteredViewer b = viewer("intruder", false);
        mvc.perform(post("/api/videos").param("creatorId", a.getId().toString())
                        .header("X-User-Id", a.getId()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"fake\",\"videoUrl\":\"https://example.test/movie.mp4\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/comments/999").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"anonymous\"}"))
                .andExpect(status().isUnauthorized());
        ContentCreator owner = new ContentCreator(); owner.setUsername("owner_" + UUID.randomUUID());
        owner.setEmail(UUID.randomUUID() + "@example.test"); owner.setPasswordHash("hash"); owner.setChannelName("Channel");
        owner = creators.saveAndFlush(owner);
        mvc.perform(post("/api/videos").header("Authorization", "Bearer " + tokens.issue(owner.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"spoof\",\"videoUrl\":\"/uploads/other.mp4\"}"))
                .andExpect(status().isBadRequest());
        Video v = video(owner, null, "PUBLISHED", "https://example.test/movie.mp4");
        String created = mvc.perform(post("/api/videos/" + v.getId() + "/comments")
                        .header("Authorization", "Bearer " + tokens.issue(a.getId()))
                        .param("viewerId", b.getId().toString()).header("X-User-Id", b.getId())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"hi\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.userId").value(a.getId()))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        Video other = video(owner, null, "PUBLISHED", "https://example.test/other.mp4");
        mvc.perform(post("/api/videos/" + other.getId() + "/comments")
                        .header("Authorization", "Bearer " + tokens.issue(a.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"cross-video\",\"parentId\":" + id + "}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/comments/" + id).header("X-User-Id", a.getId())
                        .header("Authorization", "Bearer " + tokens.issue(b.getId()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"stolen\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/comments/" + id).header("Authorization", "Bearer " + tokens.issue(a.getId()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"updated\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.text").value("updated"));
    }

    private RegisteredViewer viewer(String prefix, boolean premium) {
        RegisteredViewer viewer = new RegisteredViewer(); viewer.setUsername(prefix + "_" + UUID.randomUUID());
        viewer.setEmail(UUID.randomUUID() + "@example.test"); viewer.setPasswordHash("hash");
        viewer.setDisplayName(prefix); viewer.setIsPremium(premium);
        return viewers.saveAndFlush(viewer);
    }

    private Video video(ContentCreator creator, AccessTier tier, String status, String url) {
        Video v = new Video(); v.setCreator(creator); v.setAccessTier(tier); v.setTitle("Movie");
        v.setDuration(10); v.setVideoStatus(status); v.setVideoUrl(url);
        return videos.saveAndFlush(v);
    }
}
