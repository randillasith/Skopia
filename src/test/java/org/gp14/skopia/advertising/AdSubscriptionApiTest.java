package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.*;
import org.gp14.skopia.repository.AdImpressionRepository;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "skopia.billing.demo-enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdSubscriptionApiTest {
    @Autowired MockMvc mvc;
    @Autowired AdvertisingFixture fixture;
    @Autowired TokenService tokens;
    @Autowired AdCampaignService campaigns;
    @Autowired AdvertisementService ads;
    @Autowired AdPlacementService placements;
    @Autowired AdImpressionRepository impressions;

    @Test void checkoutPlanChangeAndCancellationImmediatelyControlDelivery() throws Exception {
        var viewer = fixture.viewer();
        String bearer = "Bearer " + tokens.issue(viewer.getId());
        Long actor = fixture.officer().getId();
        var category = fixture.category("Pass demo");
        var video = fixture.video("Pass demonstration", category);
        var now = LocalDateTime.now();
        var campaign = campaigns.create(actor, new CampaignRequest("Pass campaign", "Demo studio",
                now.minusDays(1), now.plusDays(30), BigDecimal.ZERO));
        var ad = ads.create(actor, new AdvertisementRequest(campaign.id(), "Demo creative",
                "/uploads/ads/demo.mp4", AdType.VIDEO, 20, "https://example.invalid/demo"));
        var placement = placements.attach(actor, ad.id(), new PlacementRequest(video.getId(), null,
                SlotPosition.PREROLL, 1, null, null));
        ads.activate(actor, ad.id()); campaigns.confirm(actor, campaign.id());

        mvc.perform(get("/api/ads/active").param("videoId", video.getId().toString()).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        long before = impressions.count();
        Long impressionId = impressions.findAll().get(0).getId();
        mvc.perform(post("/api/ads/click/" + impressionId).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.destination").value("https://example.invalid/demo"));
        mvc.perform(post("/api/ads/click/" + impressionId))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/billing/checkout").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("""
                {"planName":"MONTHLY","cardNumber":"4216000000000002","expiry":"12/99","cardholderName":"Demo Viewer"}
                """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status.adFree").value(true));
        mvc.perform(get("/api/billing/plans")).andExpect(status().isOk())
                .andExpect(jsonPath("$.plans[0].adFree").value(true)).andExpect(jsonPath("$.plans[1].adFree").value(true));
        // A caller-supplied id cannot change the subscriber identified by the token.
        mvc.perform(get("/api/ads/active").param("videoId", video.getId().toString())
                .param("viewerId", "999").header("X-User-Id", "999").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(post("/api/ads/impressions").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"placementId\":" + placement.id() + ",\"videoId\":" + video.getId() + "}"))
                .andExpect(status().isForbidden());
        assertThat(impressions.count()).isEqualTo(before);
        mvc.perform(post("/api/billing/change-plan").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"planName\":\"YEARLY\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status.adFree").value(true));
        mvc.perform(get("/api/ads/active").param("videoId", video.getId().toString()).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(post("/api/billing/cancel").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.adFree").value(false));
        mvc.perform(get("/api/ads/active").param("videoId", video.getId().toString()).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        // Guests remain ad-supported even if they name a subscriber in a header.
        mvc.perform(get("/api/ads/active").param("videoId", video.getId().toString()).header("X-User-Id", viewer.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }
}
