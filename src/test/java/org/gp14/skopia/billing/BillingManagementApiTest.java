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
    @Autowired NotificationRepository notifications;
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
        return "{\"planName\":\"" + plan + "\",\"brand\":\"VISA\",\"billing\":{\"fullName\":\"Demo Viewer\",\"email\":\"demo@example.test\",\"phone\":\"0771234567\",\"addressLine1\":\"Sample Street\",\"city\":\"Colombo\",\"postalCode\":\"00100\",\"country\":\"LK\"}}";
    }

    @Test
    void aSecondPreviewDoesNotBypassAnActivePass() throws Exception {
        RegisteredViewer owner = viewer("switchOwner");
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isConflict());
        assertThat(subscriptions.findByViewerId(owner.getId())).hasSize(1);
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId())).hasSize(1);
    }

    @Test
    void viewerRefundsAreOwnedBoundedAndLimitedToOnePendingPerPayment() throws Exception {
        RegisteredViewer owner = viewer("refundOwner");
        RegisteredViewer other = viewer("refundOther");
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        Long paymentId = payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId()).get(0).getId();

        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(other))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"category\":\"OTHER\",\"reason\":\"This is not mine\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"category\":\"ACCIDENTAL_PURCHASE\",\"reason\":\"  Changed my mind  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.reason").value("Changed my mind"));
        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"category\":\"DUPLICATE_PURCHASE\",\"reason\":\"Duplicate request\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"category\":\"OTHER\",\"reason\":\"" + "x".repeat(256) + "\"}"))
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
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        var payment = payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId()).get(0);
        mvc.perform(post("/api/billing/payments/" + payment.getId() + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + payment.getId() + ",\"category\":\"OTHER\",\"reason\":\"Please revoke\"}"))
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
        assertThat(unchanged.getAmount()).isEqualByComparingTo("500.00");
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
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        Long paymentId = payments.findAll().get(0).getId();
        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":" + paymentId + ",\"category\":\"OTHER\",\"reason\":\"Review this request\"}"))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/billing/admin/users").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].email").value(owner.getEmail()))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].displayName").value("Ada Viewer"))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].planName").value("MONTHLY"))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].payment.id").value(paymentId.intValue()))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].payment.payMethod").value("CARD_PREVIEW_VISA"))
                .andExpect(jsonPath("$[?(@.username == 'adminDtoOwner')].refund.status").value("PENDING"));
    }

    @Test
    void refundEligibilityCategoryCancellationHistoryAndPermanentDuplicateRule() throws Exception {
        RegisteredViewer owner = viewer("refundLifecycle");
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        Long paymentId = payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId()).get(0).getId();

        mvc.perform(get("/api/billing/payments/" + paymentId + "/refund-eligibility")
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligible").value(true))
                .andExpect(jsonPath("$.reason").value("ELIGIBLE"))
                .andExpect(jsonPath("$.windowDays").value(30));

        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds")
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"ACCIDENTAL_PURCHASE\",\"reason\":\"Too short\"}"))
                .andExpect(status().isBadRequest());

        String created = mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds")
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"ACCIDENTAL_PURCHASE\",\"reason\":\"I selected the wrong demo subscription.\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("ACCIDENTAL_PURCHASE"))
                .andExpect(jsonPath("$.currency").value("LKR"))
                .andExpect(jsonPath("$.simulation").value(true))
                .andReturn().getResponse().getContentAsString();
        long refundId = new com.fasterxml.jackson.databind.ObjectMapper().readTree(created).get("id").asLong();

        mvc.perform(get("/api/billing/refunds/" + refundId + "/history")
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].toStatus").value("PENDING"));

        mvc.perform(post("/api/billing/refunds/" + refundId + "/cancel")
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds")
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"OTHER\",\"reason\":\"Trying to submit this payment again.\"}"))
                .andExpect(status().isConflict());

        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(owner.getId()))
                .extracting(n -> n.getNotifType())
                .contains("REFUND_REQUESTED", "REFUND_CANCELLED");
    }

    @Test
    void adminRefundQueueSupportsDecisionNotificationFilteringCountAndCsv() throws Exception {
        RegisteredViewer owner = viewer("refundQueueOwner");
        Administrator admin = admin("refundQueueAdmin");
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(checkoutBody("MONTHLY")))
                .andExpect(status().isCreated());
        Long paymentId = payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId()).get(0).getId();
        String created = mvc.perform(post("/api/billing/payments/" + paymentId + "/refunds")
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"TECHNICAL_ISSUE\",\"reason\":\"Premium access did not work as expected.\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long refundId = new com.fasterxml.jackson.databind.ObjectMapper().readTree(created).get("id").asLong();

        mvc.perform(get("/api/billing/admin/refunds/pending-count").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
        mvc.perform(get("/api/billing/admin/refunds?status=PENDING&category=TECHNICAL_ISSUE&q=refundQueueOwner&page=0&size=25")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(refundId))
                .andExpect(jsonPath("$.totalElements").value(1));

        mvc.perform(post("/api/billing/admin/refunds/" + refundId + "/decision")
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECTED\",\"note\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/billing/admin/refunds/" + refundId + "/decision")
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECTED\",\"note\":\"Outside the demo refund policy.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));

        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(owner.getId()))
                .extracting(n -> n.getNotifType()).contains("REFUND_REJECTED");
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(admin.getId()))
                .extracting(n -> n.getNotifType()).contains("REFUND_ADMIN_NEW");

        mvc.perform(get("/api/billing/admin/refunds/export.csv?status=REJECTED")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("text/csv")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("refundQueueOwner")))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("4216000000000002"))));
    }
}
