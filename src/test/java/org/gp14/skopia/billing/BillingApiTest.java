package org.gp14.skopia.billing;

import org.gp14.skopia.model.user.*;
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
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@TestPropertySource(properties="skopia.billing.demo-enabled=true") @Transactional
class BillingApiTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired ContentCreatorRepository creators;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired PaymentRepository payments;
    @Autowired TokenService tokens;
    @Autowired BillingService billing;
    private RegisteredViewer viewer(String name) {
        var v=new RegisteredViewer(); v.setUsername(name); v.setEmail(name+"@example.test");
        v.setPasswordHash("test-only-hash"); return viewers.saveAndFlush(v);
    }
    private String auth(User user) { return "Bearer "+tokens.issue(user.getId()); }
    private String preview() { return "{\"planName\":\"MONTHLY\",\"brand\":\"AMEX\",\"billing\":{\"fullName\":\"Demo User\",\"email\":\"demo@example.test\",\"phone\":\"0771234567\",\"addressLine1\":\"Sample Street\",\"city\":\"Colombo\",\"postalCode\":\"00100\",\"country\":\"LK\"}}"; }
    @Test void previewIsOwnedImmutableAndOneTime() throws Exception {
        var owner=viewer("billingOwner"); var other=viewer("billingOther");
        mvc.perform(get("/api/billing/plans")).andExpect(status().isOk())
            .andExpect(jsonPath("$.plans.length()").value(1)).andExpect(jsonPath("$.plans[0].price").value(500))
            .andExpect(jsonPath("$.currency").value("LKR")).andExpect(jsonPath("$.autoRenew").value(false));
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(owner))
            .contentType(MediaType.APPLICATION_JSON).content(preview()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.paymentId").exists());
        assertThat(billing.hasActivePremium(owner.getId())).isTrue();
        var payment=payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId()).get(0);
        mvc.perform(get("/api/billing/payments/"+payment.getId()).header("Authorization",auth(other)))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(owner))
            .contentType(MediaType.APPLICATION_JSON).content(preview())).andExpect(status().isConflict());
        assertThat(subscriptions.findByViewerId(owner.getId())).singleElement().satisfies(s->assertThat(s.getAutoRenew()).isFalse());
        payment.setPayStatus("REFUNDED");
        assertThatThrownBy(payments::flush).hasStackTraceContaining("Payments are immutable");
    }
    @Test void creatorAccessAndExpiryAreEvaluatedFromSubscription() throws Exception {
        var creator=new ContentCreator(); creator.setUsername("billingCreator"); creator.setEmail("billingCreator@example.test");
        creator.setPasswordHash("test-only-hash"); creator.setChannelName("Demo creator"); creator=creators.saveAndFlush(creator);
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(creator))
            .contentType(MediaType.APPLICATION_JSON).content(preview())).andExpect(status().isCreated());
        assertThat(billing.hasAdFreeSubscription(creator.getId())).isTrue();
        var s=subscriptions.findByViewerId(creator.getId()).get(0); s.setEndDate(LocalDateTime.now().minusMinutes(1)); subscriptions.saveAndFlush(s);
        assertThat(billing.hasActivePremium(creator.getId())).isFalse();
        mvc.perform(get("/api/billing/status").header("Authorization",auth(creator)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("EXPIRED"));
    }
    @Test void rejectsLegacyPanAndForgedIdentity() throws Exception {
        var owner=viewer("billingReject");
        mvc.perform(post("/api/billing/orders/card-preview").header("X-User-Id",owner.getId())
            .contentType(MediaType.APPLICATION_JSON).content(preview())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/billing/checkout").header("Authorization",auth(owner))
            .contentType(MediaType.APPLICATION_JSON).content("{\"cardNumber\":\"4216000000000002\"}"))
            .andExpect(status().isGone());
        assertThat(payments.count()).isZero();
    }
}
