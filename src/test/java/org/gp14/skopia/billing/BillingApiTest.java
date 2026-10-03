package org.gp14.skopia.billing;

import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.repository.SubscriptionRepository;
import org.gp14.skopia.repository.PaymentRepository;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.ActiveProfiles;
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
    @Autowired SubscriptionRepository subscriptions;
    @Autowired PaymentRepository payments;
    @Autowired TokenService tokens;
    @Autowired BillingService billing;

    private RegisteredViewer viewer(String name) {
        RegisteredViewer v = new RegisteredViewer();
        v.setUsername(name); v.setEmail(name + "@example.test"); v.setPasswordHash("test-only-hash");
        return viewers.saveAndFlush(v);
    }
    private String bearer(RegisteredViewer v) { return "Bearer " + tokens.issue(v.getId()); }
    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder checkout(RegisteredViewer v, String body) {
        return post("/api/billing/checkout").header("Authorization", bearer(v))
                .contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test void demoCheckoutIsOwnerOnlyNoChargeAndImmutable() throws Exception {
        RegisteredViewer owner = viewer("billingOwner");
        RegisteredViewer other = viewer("billingOther");
        mvc.perform(get("/api/billing/plans")).andExpect(status().isOk())
                .andExpect(jsonPath("$.demoEnabled").value(true))
                .andExpect(jsonPath("$.plans[0].planName").exists());
        mvc.perform(checkout(owner, "{\"planName\":\"MONTHLY\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status.premium").value(true))
                .andExpect(jsonPath("$.payment.amount").value(0.0))
                .andExpect(jsonPath("$.payment.payMethod").value("DEMO_NO_CHARGE"));
        assertThat(billing.hasActivePremium(owner.getId())).isTrue();
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isPremium").value(true));
        Long id = payments.findAll().get(0).getId();
        mvc.perform(get("/api/billing/payments").header("Authorization", bearer(other)))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/api/billing/payments/" + id).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/billing/payments/" + id).header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.planName").value("MONTHLY"));
        mvc.perform(put("/api/billing/payments/" + id).header("Authorization", bearer(owner)))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(delete("/api/billing/payments/" + id).header("Authorization", bearer(owner)))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(checkout(owner, "{\"planName\":\"YEARLY\"}"))
                .andExpect(status().isConflict());
        assertThat(payments.count()).isEqualTo(1);
        mvc.perform(post("/api/billing/cancel").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.premium").value(false));
        assertThat(billing.hasActivePremium(owner.getId())).isFalse();
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isPremium").value(false));
        assertThat(payments.count()).isEqualTo(1);
    }

    @Test void rejectsUnauthenticatedUnknownFieldsAndInvalidPlans() throws Exception {
        RegisteredViewer v = viewer("billingReject");
        mvc.perform(post("/api/billing/checkout").header("X-User-Id",v.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"planName\":\"MONTHLY\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(checkout(v, "{\"planName\":\"MONTHLY\",\"cardNumber\":\"1234\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(checkout(v, "{\"planName\":\"WEEKLY\"}"))
                .andExpect(status().isBadRequest());
        assertThat(payments.count()).isZero();
    }

    @Test void expiryAndSuspensionDenyEntitlementEvenIfLegacyFlagTrue() throws Exception {
        RegisteredViewer v = viewer("billingExpired");
        mvc.perform(checkout(v, "{\"planName\":\"MONTHLY\"}")).andExpect(status().isCreated());
        var sub = subscriptions.findByViewerId(v.getId()).get(0);
        sub.setEndDate(LocalDateTime.now().minusMinutes(1)); subscriptions.saveAndFlush(sub);
        assertThat(billing.hasActivePremium(v.getId())).isFalse();
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(v)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isPremium").value(false));
        v.setAccountStatus("SUSPENDED"); viewers.saveAndFlush(v);
        assertThat(billing.hasActivePremium(v.getId())).isFalse();
    }

    @Test void paymentCannotBeChangedInThePersistenceLayer() throws Exception {
        RegisteredViewer v = viewer("billingImmutableUpdate");
        mvc.perform(checkout(v, "{\"planName\":\"MONTHLY\"}")).andExpect(status().isCreated());
        var payment = payments.findAll().get(0);
        payment.setPayStatus("REFUNDED");
        assertThatThrownBy(payments::flush).hasStackTraceContaining("Payments are immutable");
    }

    @Test void paymentCannotBeDeletedInThePersistenceLayer() throws Exception {
        RegisteredViewer v = viewer("billingImmutableDelete");
        mvc.perform(checkout(v, "{\"planName\":\"MONTHLY\"}")).andExpect(status().isCreated());
        var payment = payments.findAll().get(0);
        assertThatThrownBy(() -> payments.delete(payment)).hasStackTraceContaining("Payments are immutable");
    }
}
