package org.gp14.skopia.billing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@TestPropertySource(properties="skopia.billing.demo-enabled=true") @Transactional
class DemoCardOrderApiTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired PaymentRepository payments;
    @Autowired BillingOrderRepository orders;
    @Autowired TokenService tokens;
    @Autowired ObjectMapper json;
    @Autowired BillingService billing;
    @Autowired AdministratorRepository admins;
    @Autowired org.gp14.skopia.mail.BillingMailOutboxRepository outbox;
    @Autowired RefundRepository refunds;
    private RegisteredViewer viewer() {
        var v = new RegisteredViewer(); v.setUsername("cardDemo"+UUID.randomUUID().toString().replace("-", ""));
        v.setEmail(v.getUsername()+"@example.test"); v.setPasswordHash("test-only-hash");
        return viewers.saveAndFlush(v);
    }
    private String auth(RegisteredViewer v) { return "Bearer "+tokens.issue(v.getId()); }
    private String payload() { return "{\"planName\":\"MONTHLY\",\"brand\":\"VISA\",\"billing\":{\"fullName\":\"Demo Viewer\",\"email\":\"demo@example.test\",\"phone\":\"0771234567\",\"addressLine1\":\"Demo Street\",\"city\":\"Colombo\",\"postalCode\":\"00100\",\"country\":\"LK\"}}"; }
    @Test void demoCheckoutRecordsRefundable500WithoutOpeningRetiredRoutes() throws Exception {
        var v=viewer();
        mvc.perform(post("/api/billing/orders/no-charge-card").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isGone());
        mvc.perform(post("/api/billing/orders/demo-card").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content(payload()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.method").value("DEMO_CARD"))
            .andExpect(jsonPath("$.brand").value("VISA")).andExpect(jsonPath("$.amount").value(500))
            .andExpect(jsonPath("$.status").value("SIMULATED_APPROVED"))
            .andExpect(jsonPath("$.paymentId").isNumber()).andExpect(jsonPath("$.simulation").value(true));
        var term=subscriptions.findByViewerId(v.getId()).get(0);
        assertThat(term.getAutoRenew()).isFalse();
        assertThat(java.time.Duration.between(term.getStartDate(),term.getEndDate()).toDays()).isEqualTo(30);
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(v.getId())).singleElement().satisfies(p -> {
            assertThat(p.getAmount()).isEqualByComparingTo("500.00");
            assertThat(p.getPayStatus()).isEqualTo("SIMULATED");
            assertThat(p.getPayMethod()).isEqualTo("CARD_PREVIEW_VISA");
        });
        mvc.perform(post("/api/billing/orders/demo-card").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isConflict());
        assertThat(orders.findByOwnerIdOrderBySubmittedAtDescIdDesc(v.getId())).hasSize(1);
        mvc.perform(post("/api/billing/cancel").header("Authorization",auth(v)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.premium").value(false));
    }
    @Test void refundLifecycleQueuesRequestAndApprovalMailAndCannotRefundTwice() throws Exception {
        var v=viewer(); var other=viewer();
        var admin=new org.gp14.skopia.model.user.Administrator();
        admin.setUsername("refundAdmin"+UUID.randomUUID().toString().replace("-", ""));
        admin.setEmail(admin.getUsername()+"@example.test"); admin.setPasswordHash("test-only-hash");
        admin.setDesignation("Administrator"); admin.setAdminLevel("MAIN"); admin.setHireDate(java.time.LocalDate.now());
        admin=admins.saveAndFlush(admin);
        var order=billingOrder(v);
        long payment=order.paymentId();
        mvc.perform(get("/api/billing/payments/"+payment+"/refund-eligibility").header("Authorization",auth(v)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.eligible").value(true));
        mvc.perform(post("/api/billing/payments/"+payment+"/refunds").header("Authorization",auth(other))
            .contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"ACCIDENTAL_PURCHASE\",\"reason\":\"Selected wrong demo plan\"}"))
            .andExpect(status().isNotFound());
        var result=mvc.perform(post("/api/billing/payments/"+payment+"/refunds").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"ACCIDENTAL_PURCHASE\",\"reason\":\"Selected wrong demo plan\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value(500))
            .andExpect(jsonPath("$.status").value("PENDING")).andReturn();
        long refund=json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        assertThat(outbox.findAll().stream().filter(row -> row.getEventKey().equals("REFUND_PENDING:"+refund)))
            .hasSize(2).allSatisfy(row -> assertThat(row.getBody()).contains("LKR 500.00", "Status: PENDING"));
        mvc.perform(post("/api/billing/admin/refunds/"+refund+"/decision").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVED\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/billing/admin/refunds/"+refund+"/decision").header("Authorization","Bearer "+tokens.issue(admin.getId()))
            .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVED\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"))
            .andExpect(jsonPath("$.amount").value(500));
        assertThat(outbox.findAll().stream().filter(row -> row.getEventKey().equals("REFUND_APPROVED:"+refund)))
            .hasSize(2).allSatisfy(row -> assertThat(row.getBody()).contains("LKR 500.00", "Status: APPROVED", "No real money"));
        mvc.perform(get("/api/billing/status").header("Authorization",auth(v)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.premium").value(false));
        mvc.perform(get("/api/billing/refunds").header("Authorization",auth(v)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("APPROVED"));
        mvc.perform(get("/api/billing/payments/"+payment+"/refund-eligibility").header("Authorization",auth(v)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.eligible").value(false))
            .andExpect(jsonPath("$.reason").value("ALREADY_REQUESTED"));
        mvc.perform(post("/api/billing/payments/"+payment+"/refunds").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"OTHER\",\"reason\":\"Second request must be blocked\"}"))
            .andExpect(status().isConflict());
        assertThat(billing.payments(v.getId())).singleElement().satisfies(p -> {
            assertThat(p.amount()).isEqualByComparingTo("500.00"); assertThat(p.payStatus()).isEqualTo("SIMULATED");
        });
        assertThat(billing.refundHistory(v,refund)).hasSize(2);
    }
    private BillingDtos.OrderView billingOrder(RegisteredViewer v) throws Exception {
        var response=mvc.perform(post("/api/billing/orders/demo-card").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isCreated()).andReturn();
        return json.readValue(response.getResponse().getContentAsString(),BillingDtos.OrderView.class);
    }
    @Test void rejectsCardCredentialsEvenInsideContactWithNoWritesAndNoEcho() throws Exception {
        var v=viewer();
        String synthetic="4"+"1".repeat(15);
        for (String field : new String[]{"cardNumber","pan","cvv","expiry","expirationMonth","expirationYear"}) {
            for (boolean nested : new boolean[]{false,true}) {
                ObjectNode body=(ObjectNode)json.readTree(payload());
                (nested ? (ObjectNode)body.get("billing") : body).put(field,synthetic);
                mvc.perform(post("/api/billing/orders/demo-card").header("Authorization",auth(v))
                    .contentType(MediaType.APPLICATION_JSON).content(body.toString()))
                    .andExpect(status().isBadRequest())
                    .andExpect(result->assertThat(result.getResponse().getContentAsString()).doesNotContain(synthetic));
            }
        }
        for(String field : new String[]{"fullName","email","phone","addressLine1","addressLine2","city","postalCode"}) {
            ObjectNode body=(ObjectNode)json.readTree(payload());
            ((ObjectNode)body.get("billing")).put(field,field.equals("email")?"person"+synthetic+"@example.test":synthetic);
            mvc.perform(post("/api/billing/orders/demo-card").header("Authorization",auth(v))
                .contentType(MediaType.APPLICATION_JSON).content(body.toString())).andExpect(status().isBadRequest());
        }
        assertThat(orders.findByOwnerIdOrderBySubmittedAtDescIdDesc(v.getId())).isEmpty();
        assertThat(subscriptions.findByViewerId(v.getId())).isEmpty();
    }
    @Test void supportsMastercardButRejectsUnknownBrandsAndRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/billing/orders/demo-card").contentType(MediaType.APPLICATION_JSON).content(payload()))
            .andExpect(status().isUnauthorized());
        var v=viewer();
        mvc.perform(post("/api/billing/orders/demo-card").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content(payload().replace("VISA","AMEX"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/billing/orders/demo-card").header("Authorization",auth(v))
            .contentType(MediaType.APPLICATION_JSON).content(payload().replace("VISA","MASTERCARD")))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.brand").value("MASTERCARD"));
    }
}
