package org.gp14.skopia.billing;

import org.gp14.skopia.model.subscription.Refund;
import org.gp14.skopia.model.user.ActivityLog;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.RegisteredViewer;
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

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "skopia.billing.demo-enabled=true")
@Transactional
class BillingManagementApiTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired AdministratorRepository administrators;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired PaymentRepository payments;
    @Autowired RefundRepository refunds;
    @Autowired ActivityLogRepository activityLogs;
    @Autowired TokenService tokens;
    @Autowired BillingService billing;

    private RegisteredViewer viewer(String name) {
        RegisteredViewer viewer = new RegisteredViewer();
        viewer.setUsername(name);
        viewer.setEmail(name + "@example.test");
        viewer.setPasswordHash("test-only-hash");
        return viewers.saveAndFlush(viewer);
    }

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

    private String bearer(org.gp14.skopia.model.user.User user) {
        return "Bearer " + tokens.issue(user.getId());
    }

    private String checkoutBody(String plan) {
        return "{\"planName\":\"" + plan + "\",\"cardNumber\":\"4216000000000002\","
                + "\"expiry\":\"12/99\",\"cardholderName\":\"Demo Viewer\"}";
    }

    @Test
    void replacesActivePlanAtomicallyAndKeepsImmutableZeroAmountLedger() throws Exception {
        RegisteredViewer owner = viewer("switchOwner");
        mvc.perform(post("/api/billing/checkout").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/billing/checkout").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("YEARLY")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status.planName").value("YEARLY"))
                .andExpect(jsonPath("$.payment.amount").value(0.0))
                .andExpect(jsonPath("$.payment.payStatus").value("SIMULATED"));

        var all = subscriptions.findByViewerId(owner.getId());
        assertThat(all).hasSize(2);
        assertThat(all).filteredOn(s -> "ACTIVE".equals(s.getSubStatus())).singleElement()
                .extracting(s -> s.getPlan().getPlanName()).isEqualTo("YEARLY");
        assertThat(all).filteredOn(s -> "CANCELLED".equals(s.getSubStatus())).hasSize(1);
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId())).hasSize(2)
                .allSatisfy(payment -> {
                    assertThat(payment.getAmount()).isZero();
                    assertThat(payment.getPayStatus()).isEqualTo("SIMULATED");
                    assertThat(payment.getPayMethod()).isEqualTo("DEMO_TEST_VISA_0002");
                });
        assertThat(billing.hasActivePremium(owner.getId())).isTrue();

        mvc.perform(post("/api/billing/checkout").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("YEARLY")))
                .andExpect(status().isConflict());
        assertThat(subscriptions.findByViewerId(owner.getId())).hasSize(2);
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId())).hasSize(2);
    }

    @Test
    void viewerRefundsAreOwnedBoundedAndLimitedToOnePendingPerPayment() throws Exception {
        RegisteredViewer owner = viewer("refundOwner");
        RegisteredViewer other = viewer("refundOther");
        mvc.perform(post("/api/billing/checkout").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        Long paymentId = payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId()).get(0).getId();

        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(other))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"reason\":\"Not mine\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"reason\":\"  Changed my mind  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.reason").value("Changed my mind"));
        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"reason\":\"Duplicate\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"reason\":\"" + "x".repeat(256) + "\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/billing/refunds").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].paymentId").value(paymentId));
        mvc.perform(get("/api/billing/refunds").header("Authorization", bearer(other)))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void adminProcessesPendingRefundOnceAndApprovalRevokesEntitlementWithoutChangingPayment() throws Exception {
        RegisteredViewer owner = viewer("approvalOwner");
        Administrator admin = admin("refundAdmin");
        mvc.perform(post("/api/billing/checkout").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        var payment = payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId()).get(0);
        mvc.perform(post("/api/billing/payments/" + payment.getId() + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + payment.getId() + ",\"reason\":\"Please revoke\"}"))
                .andExpect(status().isCreated());
        Refund refund = refunds.findAll().get(0);

        mvc.perform(get("/api/billing/admin/refunds").header("Authorization", bearer(owner)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/billing/admin/refunds/" + refund.getId() + "/approve")
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"Approved for demo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.processedByEmail").value(admin.getEmail()))
                .andExpect(jsonPath("$.processingNote").value("Approved for demo"));

        assertThat(billing.hasActivePremium(owner.getId())).isFalse();
        assertThat(viewers.findById(owner.getId()).orElseThrow().getIsPremium()).isFalse();
        var unchanged = payments.findById(payment.getId()).orElseThrow();
        assertThat(unchanged.getPayStatus()).isEqualTo("SIMULATED");
        assertThat(unchanged.getAmount()).isZero();
        assertThat(payments.count()).isEqualTo(1);

        mvc.perform(post("/api/billing/admin/refunds/" + refund.getId() + "/reject")
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"Too late\"}"))
                .andExpect(status().isConflict());
        List<ActivityLog> logs = activityLogs.findByActionTypeContainingIgnoreCaseOrderByActionTimeDesc("REFUND");
        assertThat(logs).anySatisfy(log -> {
            assertThat(log.getActor().getId()).isEqualTo(admin.getId());
            assertThat(log.getTargetUser().getId()).isEqualTo(owner.getId());
            assertThat(log.getActionType()).contains("APPROVED");
            assertThat(log.getDetail()).contains(refund.getId().toString());
        });
    }

    @Test
    void adminSubscriptionDtoContainsIdentityPlanSafePaymentAndRefundFields() throws Exception {
        RegisteredViewer owner = viewer("adminDtoOwner");
        owner.setFirstName("Ada");
        owner.setLastName("Viewer");
        viewers.saveAndFlush(owner);
        Administrator admin = admin("dtoAdmin");
        mvc.perform(post("/api/billing/checkout").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        Long paymentId = payments.findAll().get(0).getId();
        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"reason\":\"Review me\"}"))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/billing/admin/users").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].email").value(owner.getEmail()))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].displayName").value("Ada Viewer"))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].planName").value("MONTHLY"))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].payment.id").value(paymentId.intValue()))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].payment.payMethod").value("DEMO_TEST_VISA_0002"))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].refund.status").value("PENDING"));
    }
}
