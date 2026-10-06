package org.gp14.skopia.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.user.User;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "skopia.billing.demo-enabled=true")
@Transactional
class SubscriptionPaymentCrudApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TokenService tokens;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired AdministratorRepository administrators;
    @Autowired SubscriptionPlanRepository plans;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired PaymentRepository payments;
    @Autowired RefundRepository refunds;
    @Autowired NotificationRepository notifications;
    @Autowired SubscriptionReminderService reminders;

    private RegisteredViewer viewer(String name) {
        RegisteredViewer viewer = new RegisteredViewer();
        viewer.setUsername(name); viewer.setEmail(name + "@example.test"); viewer.setPasswordHash("test-only");
        return viewers.saveAndFlush(viewer);
    }

    private Administrator admin() {
        Administrator admin = new Administrator();
        admin.setUsername("crudAdmin"); admin.setEmail("crud-admin@example.test"); admin.setPasswordHash("test-only");
        admin.setDesignation("Administrator"); admin.setHireDate(LocalDate.of(2024, 1, 1)); admin.setAdminLevel("PLATFORM");
        return administrators.saveAndFlush(admin);
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request, User user) {
        return request.header("Authorization", "Bearer " + tokens.issue(user.getId()));
    }

    private MockHttpServletRequestBuilder body(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private String plan(String name, int days, String price, boolean active) {
        return "{\"planName\":\"" + name + "\",\"durationDays\":" + days + ",\"price\":" + price
                + ",\"benefit\":\"Premium video access\",\"adFree\":true,\"active\":" + active + "}";
    }

    private String card() {
        return "{\"cardNumber\":\"4216000000000002\",\"expiry\":\"12/99\",\"cardholderName\":\"Demo Viewer\"}";
    }

    private JsonNode checkout(User viewer, String plan) throws Exception {
        return json.readTree(mvc.perform(as(body(post("/api/billing/subscriptions"),
                        card().replace("{", "{\"planName\":\"" + plan + "\",")), viewer))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    @Test void administratorCanCreateReadUpdateRetireAndRestorePlan() throws Exception {
        Administrator admin = admin();
        JsonNode created = json.readTree(mvc.perform(as(body(post("/api/billing/admin/plans"), plan("weekly", 7, "0.00", true)), admin))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.planName").value("WEEKLY"))
                .andReturn().getResponse().getContentAsString());
        long id = created.get("id").asLong();
        mvc.perform(as(get("/api/billing/admin/plans/" + id), admin)).andExpect(status().isOk());
        mvc.perform(as(get("/api/billing/admin/plans"), admin)).andExpect(status().isOk());
        mvc.perform(as(body(put("/api/billing/admin/plans/" + id), plan("WEEKLY", 14, "0.00", true)), admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.durationDays").value(14));
        mvc.perform(as(delete("/api/billing/admin/plans/" + id), admin)).andExpect(status().isNoContent());
        mvc.perform(get("/api/billing/plans")).andExpect(status().isOk())
                .andExpect(jsonPath("$.plans[?(@.planName == 'WEEKLY')]").isEmpty());
        mvc.perform(as(get("/api/billing/admin/plans/" + id), admin)).andExpect(jsonPath("$.active").value(false));
        mvc.perform(as(body(put("/api/billing/admin/plans/" + id), plan("WEEKLY", 7, "0.00", true)), admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(true));
        assertThat(plans.findById(id)).isPresent();
    }

    @Test void planCrudRequiresAdminAndValidatesDuplicatesAndFields() throws Exception {
        Administrator admin = admin();
        RegisteredViewer viewer = viewer("planIntruder");
        String valid = plan("WEEKLY", 7, "0.00", true);
        mvc.perform(body(post("/api/billing/admin/plans"), valid)).andExpect(status().isUnauthorized());
        mvc.perform(as(body(post("/api/billing/admin/plans"), valid), viewer)).andExpect(status().isForbidden());
        mvc.perform(as(get("/api/billing/admin/plans"), viewer)).andExpect(status().isForbidden());
        mvc.perform(as(body(post("/api/billing/admin/plans"), plan("MONTHLY", 30, "0", true)), admin)).andExpect(status().isConflict());
        for (String invalid : new String[]{plan("BAD", 0, "0", true), plan("BAD", 7, "-1", true),
                plan("BAD", 7, "1.001", true), plan("   ", 7, "0", true), "{}"}) {
            mvc.perform(as(body(post("/api/billing/admin/plans"), invalid), admin)).andExpect(status().isBadRequest());
        }
        mvc.perform(as(get("/api/billing/admin/plans/999999"), admin)).andExpect(status().isNotFound());
    }

    @Test void subscriptionCrudIsOwnerScopedAndCancellationRetainsLedger() throws Exception {
        RegisteredViewer owner = viewer("crudOwner"), other = viewer("crudOther");
        JsonNode created = checkout(owner, "MONTHLY");
        long id = created.at("/subscription/id").asLong();
        mvc.perform(as(get("/api/billing/subscriptions"), owner)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(as(get("/api/billing/subscriptions/" + id), other)).andExpect(status().isNotFound());
        mvc.perform(as(body(put("/api/billing/subscriptions/" + id), "{\"planName\":\"YEARLY\"}"), other)).andExpect(status().isNotFound());
        mvc.perform(as(delete("/api/billing/subscriptions/" + id), other)).andExpect(status().isNotFound());
        JsonNode updated = json.readTree(mvc.perform(as(body(put("/api/billing/subscriptions/" + id), "{\"planName\":\"YEARLY\"}"), owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status.planName").value("YEARLY"))
                .andReturn().getResponse().getContentAsString());
        long newId = updated.at("/subscription/id").asLong();
        mvc.perform(as(delete("/api/billing/subscriptions/" + newId), owner)).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        mvc.perform(as(delete("/api/billing/subscriptions/" + newId), owner)).andExpect(status().isOk());
        mvc.perform(as(get("/api/billing/status"), owner)).andExpect(jsonPath("$.premium").value(false));
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId())).hasSize(2);
        assertThat(subscriptions.findByViewerId(owner.getId())).hasSize(2);
    }

    @Test void renewalKeepsRemainingDaysAndCreatesANewReceiptAndConfirmation() throws Exception {
        RegisteredViewer owner = viewer("renewOwner");
        JsonNode created = checkout(owner, "MONTHLY");
        long id = created.at("/subscription/id").asLong();
        LocalDateTime originalEnd = subscriptions.findById(id).orElseThrow().getEndDate();
        JsonNode renewed = json.readTree(mvc.perform(as(body(post("/api/billing/subscriptions/" + id + "/renew"), card()), owner))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(LocalDateTime.parse(renewed.at("/subscription/endDate").asText())).isEqualTo(originalEnd.plusDays(30));
        assertThat(subscriptions.findById(id).orElseThrow().getSubStatus()).isEqualTo("RENEWED");
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId())).hasSize(2);
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(owner.getId())).filteredOn(n -> "PAYMENT_CONFIRMED".equals(n.getNotifType()))
                .hasSize(2).allSatisfy(n -> assertThat(n.getTargetUrl()).isEqualTo("/billing"));
        mvc.perform(as(body(post("/api/billing/subscriptions/" + id + "/renew"), card()), owner)).andExpect(status().isConflict());
    }

    @Test void expiredSubscriptionCanRenewButInvalidCardOrOtherOwnerCannot() throws Exception {
        RegisteredViewer owner = viewer("expiredRenewOwner"), other = viewer("expiredRenewOther");
        long id = checkout(owner, "MONTHLY").at("/subscription/id").asLong();
        var subscription = subscriptions.findById(id).orElseThrow();
        subscription.setStartDate(LocalDateTime.now().minusDays(35));
        subscription.setEndDate(LocalDateTime.now().minusDays(5));
        subscriptions.saveAndFlush(subscription);
        mvc.perform(as(body(post("/api/billing/subscriptions/" + id + "/renew"), card()), other)).andExpect(status().isNotFound());
        mvc.perform(as(body(post("/api/billing/subscriptions/" + id + "/renew"), card().replace("0002", "0003")), owner)).andExpect(status().isBadRequest());
        assertThat(payments.count()).isEqualTo(1);
        mvc.perform(as(body(post("/api/billing/subscriptions/" + id + "/renew"), card()), owner))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status.premium").value(true));
    }

    @Test void receiptsAreDownloadableOwnerOnlyAndContainNoRawCardData() throws Exception {
        RegisteredViewer owner = viewer("receiptOwner"), other = viewer("receiptOther");
        long paymentId = checkout(owner, "MONTHLY").at("/payment/id").asLong();
        mvc.perform(as(get("/api/billing/payments/" + paymentId + "/receipt"), owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.simulated").value(true))
                .andExpect(jsonPath("$.payment.cardLast4").value("0002"));
        String download = mvc.perform(as(get("/api/billing/payments/" + paymentId + "/receipt/download"), owner))
                .andExpect(status().isOk()).andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(content().string(containsString("DEMO ONLY"))).andReturn().getResponse().getContentAsString();
        assertThat(download).doesNotContain("4216000000000002", "12/99", "Demo Viewer");
        mvc.perform(as(get("/api/billing/payments/" + paymentId + "/receipt"), other)).andExpect(status().isNotFound());
        mvc.perform(as(get("/api/billing/payments/" + paymentId + "/receipt/download"), other)).andExpect(status().isNotFound());
    }

    @Test void pendingRefundCrudRetainsHistoryAndRejectsCrossOwnerMutations() throws Exception {
        RegisteredViewer owner = viewer("refundCrudOwner"), other = viewer("refundCrudOther");
        long paymentId = checkout(owner, "MONTHLY").at("/payment/id").asLong();
        long id = json.readTree(mvc.perform(as(body(post("/api/billing/payments/" + paymentId + "/refunds"), "{\"reason\":\"Please cancel my demo payment\"}"), owner))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(as(get("/api/billing/refunds/" + id), owner)).andExpect(status().isOk());
        mvc.perform(as(get("/api/billing/refunds/" + id), other)).andExpect(status().isNotFound());
        mvc.perform(as(body(put("/api/billing/refunds/" + id), "{\"reason\":\"Updated explanation\"}"), other)).andExpect(status().isNotFound());
        mvc.perform(as(delete("/api/billing/refunds/" + id), other)).andExpect(status().isNotFound());
        mvc.perform(as(body(put("/api/billing/refunds/" + id), "{\"reason\":\"Updated explanation\"}"), owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reason").value("Updated explanation"));
        mvc.perform(as(delete("/api/billing/refunds/" + id), owner)).andExpect(status().isNoContent());
        assertThat(refunds.findById(id).orElseThrow().getRefundStatus()).isEqualTo("CANCELLED");
        mvc.perform(as(body(put("/api/billing/refunds/" + id), "{\"reason\":\"Too late to change\"}"), owner)).andExpect(status().isConflict());
        assertThat(payments.findById(paymentId).orElseThrow().getPayStatus()).isEqualTo("SIMULATED");
    }

    @Test void retirementKeepsActiveBenefitsAndReceiptsButBlocksNewCheckout() throws Exception {
        Administrator admin = admin();
        RegisteredViewer owner = viewer("retireOwner"), other = viewer("retireOther");
        long paymentId = checkout(owner, "MONTHLY").at("/payment/id").asLong();
        long planId = plans.findByPlanName("MONTHLY").orElseThrow().getId();
        mvc.perform(as(body(put("/api/billing/admin/plans/" + planId), plan("RENAMED", 30, "0", true)), admin)).andExpect(status().isConflict());
        mvc.perform(as(delete("/api/billing/admin/plans/" + planId), admin)).andExpect(status().isNoContent());
        mvc.perform(as(get("/api/billing/status"), owner)).andExpect(jsonPath("$.premium").value(true));
        mvc.perform(as(get("/api/billing/payments/" + paymentId + "/receipt"), owner)).andExpect(status().isOk());
        mvc.perform(as(body(post("/api/billing/subscriptions"), card().replace("{", "{\"planName\":\"MONTHLY\",")), other)).andExpect(status().isConflict());
    }

    @Test void configurablePlansUseStoredBenefitsAndDemoRejectsNonzeroPrices() throws Exception {
        Administrator admin = admin();
        RegisteredViewer owner = viewer("customOwner");
        mvc.perform(as(body(post("/api/billing/admin/plans"), plan("WEEKLY", 7, "0", true).replace("\"adFree\":true", "\"adFree\":false")), admin))
                .andExpect(status().isCreated());
        JsonNode result = checkout(owner, "WEEKLY");
        assertThat(result.at("/status/adFree").asBoolean()).isFalse();
        assertThat(result.at("/status/premium").asBoolean()).isTrue();
        mvc.perform(as(body(post("/api/billing/admin/plans"), plan("PAID", 30, "9.99", true)), admin)).andExpect(status().isCreated());
        mvc.perform(as(body(post("/api/billing/subscriptions"), card().replace("{", "{\"planName\":\"PAID\",")), viewer("paidOwner")))
                .andExpect(status().isConflict());
    }

    @Test void renewalRemindersAreDeduplicatedAndSkipExpiredAndCancelledSubscriptions() throws Exception {
        RegisteredViewer owner = viewer("reminderOwner");
        long id = checkout(owner, "MONTHLY").at("/subscription/id").asLong();
        LocalDateTime now = LocalDateTime.now();
        var subscription = subscriptions.findById(id).orElseThrow();
        subscription.setEndDate(now.plusDays(2)); subscriptions.saveAndFlush(subscription);
        reminders.sendUpcomingRenewalReminders(now); reminders.sendUpcomingRenewalReminders(now);
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(owner.getId()))
                .filteredOn(n -> "SUBSCRIPTION_RENEWAL".equals(n.getNotifType())).hasSize(1);
        subscription.setSubStatus("CANCELLED"); subscriptions.saveAndFlush(subscription);
        reminders.sendUpcomingRenewalReminders(now);
        assertThat(notifications.findByUserIdOrderByCreatedAtDesc(owner.getId()))
                .filteredOn(n -> "SUBSCRIPTION_RENEWAL".equals(n.getNotifType())).hasSize(1);
    }

    @Test void forgedActorHeadersAndAdminUsernameCannotAuthorizeBilling() throws Exception {
        Administrator administrator = admin();
        RegisteredViewer impostor = viewer("admin");
        mvc.perform(get("/api/billing/admin/plans").header("X-User-Id", administrator.getId()))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/billing/admin/plans").header("Authorization", "Bearer invalid")
                        .header("X-User-Id", administrator.getId()))
                .andExpect(status().isUnauthorized());
        mvc.perform(as(get("/api/billing/admin/plans"), impostor)).andExpect(status().isForbidden());
    }

    @Test void finalizedRefundCannotBeEditedOrCancelledByOwner() throws Exception {
        Administrator admin = admin();
        RegisteredViewer owner = viewer("finalRefundOwner");
        long paymentId = checkout(owner, "MONTHLY").at("/payment/id").asLong();
        long id = json.readTree(mvc.perform(as(body(post("/api/billing/payments/" + paymentId + "/refunds"),
                        "{\"reason\":\"Please refund this demo subscription\"}"), owner))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(as(post("/api/billing/admin/refunds/" + id + "/approve"), admin)).andExpect(status().isOk());
        mvc.perform(as(body(put("/api/billing/refunds/" + id), "{\"reason\":\"A different reason\"}"), owner)).andExpect(status().isConflict());
        mvc.perform(as(delete("/api/billing/refunds/" + id), owner)).andExpect(status().isConflict());
        assertThat(refunds.findById(id).orElseThrow().getRefundStatus()).isEqualTo("APPROVED");
    }
}
