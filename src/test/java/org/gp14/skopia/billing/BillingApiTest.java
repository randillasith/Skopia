package org.gp14.skopia.billing;

import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.ContentCreatorRepository;
import org.gp14.skopia.repository.PaymentRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.repository.SubscriptionRepository;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties="skopia.billing.demo-enabled=true")
@Transactional
class BillingApiTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired ContentCreatorRepository creators;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired PaymentRepository payments;
    @Autowired TokenService tokens;
    @Autowired BillingService billing;

    private RegisteredViewer viewer(String name) {
        RegisteredViewer v = new RegisteredViewer();
        v.setUsername(name); v.setEmail(name + "@example.test"); v.setPasswordHash("test-only-hash");
        return viewers.saveAndFlush(v);
    }
    private String bearer(User v) { return "Bearer " + tokens.issue(v.getId()); }
    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder checkout(User v, String body) {
        return post("/api/billing/checkout").header("Authorization", bearer(v))
                .contentType(MediaType.APPLICATION_JSON).content(body);
    }
    private String validCheckout(String plan) {
        return "{\"planName\":\"" + plan + "\",\"cardNumber\":\"4216000000000002\","
                + "\"expiry\":\"12/99\",\"cardholderName\":\"Demo Viewer\"}";
    }

    @Test void demoCheckoutIsOwnerOnlyNoChargeAndImmutable() throws Exception {
        RegisteredViewer owner = viewer("billingOwner");
        RegisteredViewer other = viewer("billingOther");
        mvc.perform(get("/api/billing/plans")).andExpect(status().isOk())
                .andExpect(jsonPath("$.demoEnabled").value(true));
        mvc.perform(checkout(owner, validCheckout("MONTHLY")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status.premium").value(true))
                .andExpect(jsonPath("$.payment.amount").value(0.0))
                .andExpect(jsonPath("$.payment.payMethod").value("DEMO_TEST_VISA_0002"));
        assertThat(billing.hasActivePremium(owner.getId())).isTrue();
        Long id = payments.findAll().get(0).getId();
        mvc.perform(get("/api/billing/payments").header("Authorization", bearer(other)))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/api/billing/payments/" + id).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        mvc.perform(checkout(owner, validCheckout("YEARLY"))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.status.planName").value("YEARLY"));
        mvc.perform(post("/api/billing/cancel").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(billing.hasActivePremium(owner.getId())).isFalse();
        assertThat(payments.count()).isEqualTo(2);
    }

    @Test void rejectsUnauthenticatedUnknownFieldsAndInvalidPlans() throws Exception {
        RegisteredViewer v = viewer("billingReject");
        mvc.perform(post("/api/billing/checkout").header("X-User-Id",v.getId())
                .contentType(MediaType.APPLICATION_JSON).content(validCheckout("MONTHLY")))
                .andExpect(status().isUnauthorized());
        mvc.perform(checkout(v, validCheckout("MONTHLY").replace("}", ",\"price\":0}")))
                .andExpect(status().isBadRequest());
        mvc.perform(checkout(v, validCheckout("WEEKLY"))).andExpect(status().isBadRequest());
        assertThat(payments.count()).isZero();
    }

    @Test void validatesSyntheticCardExpiryAndNameWithoutPersistingRawData() throws Exception {
        RegisteredViewer v = viewer("billingValidation");
        mvc.perform(checkout(v, validCheckout("MONTHLY").replace("4216000000000002", "4216000000000003"))).andExpect(status().isBadRequest());
        mvc.perform(checkout(v, validCheckout("MONTHLY").replace("4216000000000002", "4111111111111111"))).andExpect(status().isBadRequest());
        mvc.perform(checkout(v, validCheckout("MONTHLY").replace("12/99", "01/20"))).andExpect(status().isBadRequest());
        mvc.perform(checkout(v, validCheckout("MONTHLY").replace("Demo Viewer", "A"))).andExpect(status().isBadRequest());
        mvc.perform(checkout(v, validCheckout("MONTHLY"))).andExpect(status().isCreated());
        var payment = payments.findAll().get(0);
        assertThat(payment.getPayMethod()).isEqualTo("DEMO_TEST_VISA_0002");
        assertThat(payment.getGatewayRef()).doesNotContain("4216000000000002");
    }

    @Test void creatorCanActivateAndStatusDistinguishesCancelledExpiredAndFree() throws Exception {
        ContentCreator creator = new ContentCreator();
        creator.setUsername("billingCreator"); creator.setEmail("billingCreator@example.test");
        creator.setPasswordHash("test-only-hash"); creator.setChannelName("Billing Creator");
        creator = creators.saveAndFlush(creator);
        mvc.perform(checkout(creator, validCheckout("YEARLY"))).andExpect(status().isCreated());
        mvc.perform(get("/api/billing/status").header("Authorization", bearer(creator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.startDate").exists());
        mvc.perform(post("/api/billing/cancel").header("Authorization", bearer(creator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        RegisteredViewer free = viewer("billingFree");
        mvc.perform(get("/api/billing/status").header("Authorization", bearer(free)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FREE"));
    }

    @Test void expiryAndSuspensionDenyEntitlementEvenIfLegacyFlagTrue() throws Exception {
        RegisteredViewer v = viewer("billingExpired");
        mvc.perform(checkout(v, validCheckout("MONTHLY"))).andExpect(status().isCreated());
        var sub = subscriptions.findByViewerId(v.getId()).get(0);
        sub.setEndDate(LocalDateTime.now().minusMinutes(1)); subscriptions.saveAndFlush(sub);
        assertThat(billing.hasActivePremium(v.getId())).isFalse();
        mvc.perform(get("/api/billing/status").header("Authorization", bearer(v)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("EXPIRED"));
        v.setAccountStatus("SUSPENDED"); viewers.saveAndFlush(v);
        assertThat(billing.hasActivePremium(v.getId())).isFalse();
    }

    @Test void paymentCannotBeChangedOrDeletedInPersistenceLayer() throws Exception {
        RegisteredViewer v = viewer("billingImmutable");
        mvc.perform(checkout(v, validCheckout("MONTHLY"))).andExpect(status().isCreated());
        var payment = payments.findAll().get(0);
        payment.setPayStatus("REFUNDED");
        assertThatThrownBy(payments::flush).hasStackTraceContaining("Payments are immutable");
    }
}
