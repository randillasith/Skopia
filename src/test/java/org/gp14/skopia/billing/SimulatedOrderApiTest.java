package org.gp14.skopia.billing;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@TestPropertySource(properties={"skopia.billing.demo-enabled=true", "skopia.billing.private-storage-dir=${java.io.tmpdir}/skopia-order-test-${random.uuid}"})
@Transactional
class SimulatedOrderApiTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired AdministratorRepository admins;
    @Autowired PaymentRepository payments;
    @Autowired BillingOrderRepository orders;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired TokenService tokens;
    @Autowired BillingService billing;
    @Autowired ObjectMapper json;
    private RegisteredViewer viewer(String name) {
        var v = new RegisteredViewer(); v.setUsername(name); v.setEmail(name+"@example.test"); v.setPasswordHash("test-only-hash");
        return viewers.saveAndFlush(v);
    }
    private Administrator admin() {
        var a = new Administrator(); a.setUsername("orderAdmin"); a.setEmail("orderAdmin@example.test");
        a.setPasswordHash("test-only-hash"); a.setDesignation("Administrator"); a.setHireDate(LocalDate.of(2024,1,1));
        a.setAdminLevel("PLATFORM"); return admins.saveAndFlush(a);
    }
    private String auth(User u) { return "Bearer " + tokens.issue(u.getId()); }
    private String billing() { return "{\"fullName\":\"Test Viewer\",\"email\":\"test@example.test\",\"phone\":\"0771234567\",\"addressLine1\":\"Sample street\",\"city\":\"Colombo\",\"postalCode\":\"00100\",\"country\":\"LK\"}"; }
    private String card() { return "{\"planName\":\"MONTHLY\",\"brand\":\"VISA\",\"billing\":"+billing()+"}"; }
    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder slip(User u, byte[] bytes, String type) {
        return multipart("/api/billing/orders/bank-transfer").file(new MockMultipartFile("slip","receipt.png",type,bytes))
            .param("planName","MONTHLY").param("billing",billing()).header("Authorization",auth(u));
    }
    private byte[] png() throws Exception {
        var output=new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(1,1,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",output);
        return output.toByteArray();
    }
    @Test void cardPreviewHasNoPanAndOnlyOwnerSeesOrder() throws Exception {
        var owner=viewer("orderOwner"); var other=viewer("orderOther");
        mvc.perform(post("/api/billing/checkout").header("Authorization",auth(owner)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"MONTHLY\",\"cardNumber\":\"4216000000000002\"}"))
            .andExpect(status().isGone());
        mvc.perform(post("/api/billing/change-plan").header("Authorization",auth(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"planName\":\"YEARLY\"}"))
            .andExpect(status().isGone());
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(owner)).contentType(MediaType.APPLICATION_JSON)
            .content(card().replace("}",",\"cardNumber\":\"4111111111111111\"}"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(owner)).contentType(MediaType.APPLICATION_JSON).content(card()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.currency").value("LKR"))
            .andExpect(jsonPath("$.amount").value(500)).andExpect(jsonPath("$.status").value("SIMULATED_APPROVED"));
        assertThat(billing.hasActivePremium(owner.getId())).isTrue();
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(owner.getId())).singleElement()
            .satisfies(p -> { assertThat(p.getAmount()).isEqualByComparingTo("500.00"); assertThat(p.getPayMethod()).isEqualTo("CARD_PREVIEW_VISA"); });
        mvc.perform(get("/api/billing/orders").header("Authorization",auth(other))).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
    }
    @Test void noChargeCardIssuesThirtyDayEntitlementWithoutPaymentAndRejectsCredentials() throws Exception {
        var owner=viewer("noChargeOwner");
        String endpoint="/api/billing/orders/no-charge-card";
        for (String field : new String[]{"cardNumber", "pan", "cvv", "expiry", "expirationMonth", "expirationYear"}) {
            mvc.perform(post(endpoint).header("Authorization",auth(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(card().replace("\"brand\"", "\""+field+"\":\"sensitive\",\"brand\"")))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(post(endpoint).header("Authorization",auth(owner)).contentType(MediaType.APPLICATION_JSON)
            .content(card().replace("VISA","AMEX"))).andExpect(status().isBadRequest());
        assertThat(payments.count()).isZero();
        assertThat(subscriptions.count()).isZero();
        var response=mvc.perform(post(endpoint).header("Authorization",auth(owner)).contentType(MediaType.APPLICATION_JSON).content(card()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value(0))
            .andExpect(jsonPath("$.status").value("NO_CHARGE_ACTIVE"))
            .andExpect(jsonPath("$.paymentId").value(org.hamcrest.Matchers.nullValue()))
            .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(response).path("notice").asText()).contains("No charge");
        assertThat(payments.count()).isZero();
        assertThat(subscriptions.count()).isEqualTo(1);
        var active=subscriptions.findByViewerIdAndSubStatusAndEndDateAfterOrderByEndDateDesc(owner.getId(),"ACTIVE",java.time.LocalDateTime.now());
        assertThat(active).singleElement().satisfies(s -> assertThat(java.time.Duration.between(s.getStartDate(),s.getEndDate()).toDays()).isEqualTo(30));
        assertThat(billing.hasActivePremium(owner.getId())).isTrue();
        mvc.perform(post(endpoint).header("Authorization",auth(owner)).contentType(MediaType.APPLICATION_JSON).content(card()))
            .andExpect(status().isConflict());
        assertThat(subscriptions.count()).isEqualTo(1);
        mvc.perform(post("/api/billing/cancel").header("Authorization",auth(owner))).andExpect(status().isOk());
        assertThat(billing.hasActivePremium(owner.getId())).isFalse();
    }
    @Test void noChargeCardRejectsUndeliverableBillingEmailWithoutEntitlement() throws Exception {
        var owner=viewer("invalidReceiptEmail");
        for (String invalid : new String[]{"viewer@example..com", ".viewer@example.test",
                "viewer.@example.test", "viewer@example.test,other@example.test"}) {
            var payload=(com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(card());
            ((com.fasterxml.jackson.databind.node.ObjectNode) payload.get("billing")).put("email",invalid);
            mvc.perform(post("/api/billing/orders/no-charge-card").header("Authorization",auth(owner))
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload)))
                .andExpect(status().isBadRequest());
            assertThat(orders.count()).isZero();
            assertThat(subscriptions.count()).isZero();
            assertThat(payments.count()).isZero();
        }
    }
    @Test void noChargeCardRejectsEmbeddedCardNumbersInEveryPersistedContactField() throws Exception {
        var owner=viewer("noChargeContactGuard");
        String testNumber = "4" + "1".repeat(15);
        String grouped = "Sample " + String.join("-", "4111", "1111", "1111", "1111") + " detail";
        for (String field : new String[]{"fullName", "email", "phone", "addressLine1", "addressLine2", "city", "postalCode"}) {
            var payload=(com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(card());
            var contact=(com.fasterxml.jackson.databind.node.ObjectNode) payload.get("billing");
            String leaked=field.equals("email") ? "user" + testNumber + "@example.test"
                    : field.equals("phone") ? testNumber
                    : grouped;
            contact.put(field,leaked);
            mvc.perform(post("/api/billing/orders/no-charge-card").header("Authorization",auth(owner))
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString()).doesNotContain(leaked));
            assertThat(orders.count()).isZero();
            assertThat(subscriptions.count()).isZero();
        }
        var nested=(com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(card());
        ((com.fasterxml.jackson.databind.node.ObjectNode) nested.get("billing")).put("cardNumber", testNumber);
        mvc.perform(post("/api/billing/orders/no-charge-card").header("Authorization",auth(owner))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(nested)))
            .andExpect(status().isBadRequest());
        for (String number : new String[]{"4" + "2".repeat(12), "4" + "0".repeat(17) + "6"}) {
            var payload=(com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(card());
            ((com.fasterxml.jackson.databind.node.ObjectNode) payload.get("billing")).put("addressLine1", "Unit " + number);
            mvc.perform(post("/api/billing/orders/no-charge-card").header("Authorization",auth(owner))
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload)))
                .andExpect(status().isBadRequest());
        }
        assertThat(orders.count()).isZero();
        mvc.perform(post("/api/billing/orders/no-charge-card").header("Authorization",auth(owner))
                .contentType(MediaType.APPLICATION_JSON).content(card()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.billing.phone").value("0771234567"));
        assertThat(orders.count()).isEqualTo(1);
    }
    @Test void mastercardIsBrandOnlyAndNeverProducesCardDigits() throws Exception {
        var owner=viewer("mastercardPreview");
        mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(owner))
                .contentType(MediaType.APPLICATION_JSON).content(card().replace("VISA","MASTERCARD")))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.brand").value("MASTERCARD"));
        mvc.perform(get("/api/billing/payments").header("Authorization",auth(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].cardBrand").value("MASTERCARD"))
            .andExpect(jsonPath("$[0].cardLast4").value(org.hamcrest.Matchers.nullValue()));
    }
    @Test void slipNeedsExplicitAdminApprovalAndDownloadIsPrivate() throws Exception {
        var owner=viewer("slipOwner"); var other=viewer("slipOther"); var admin=admin();
        byte[] png=png();
        mvc.perform(slip(owner,"not a png".getBytes(),"image/png")).andExpect(status().isBadRequest());
        mvc.perform(slip(owner,new byte[5_242_881],"image/png")).andExpect(status().isBadRequest());
        var result=mvc.perform(slip(owner,png,"image/png")).andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("PENDING_REVIEW")).andReturn().getResponse().getContentAsString();
        long id=json.readTree(result).path("id").asLong();
        assertThat(billing.hasActivePremium(owner.getId())).isFalse(); assertThat(payments.count()).isZero();
        mvc.perform(get("/api/billing/admin/orders").header("Authorization",auth(other))).andExpect(status().isForbidden());
        mvc.perform(get("/api/billing/admin/orders/"+id+"/slip").header("Authorization",auth(other))).andExpect(status().isForbidden());
        mvc.perform(get("/api/billing/admin/orders/"+id+"/slip").header("Authorization",auth(admin)))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(content().bytes(png));
        mvc.perform(get("/uploads/"+id).header("Authorization",auth(owner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/billing/orders").header("Authorization",auth(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(get("/api/billing/orders").header("Authorization",auth(other)))
            .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/api/billing/admin/orders").header("Authorization",auth(admin)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].ownerId").value(owner.getId()));
        mvc.perform(get("/api/billing/admin/orders/99999999/slip").header("Authorization",auth(admin)))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/billing/admin/orders/"+id+"/decision").header("Authorization",auth(other))
            .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVED\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/billing/admin/orders/"+id+"/decision").header("Authorization",auth(admin))
            .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVED\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        assertThat(billing.hasActivePremium(owner.getId())).isTrue(); assertThat(payments.count()).isEqualTo(1);
        mvc.perform(post("/api/billing/admin/orders/"+id+"/decision").header("Authorization",auth(admin))
            .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVED\"}"))
            .andExpect(status().isConflict()); assertThat(payments.count()).isEqualTo(1);
 }
 @Test void rejectionNeverGrantsAccessAndInvalidInputsAreRejected() throws Exception {
 var owner=viewer("rejectOrder"); var admin=admin();
 byte[] jpeg=new byte[]{(byte)255,(byte)216,(byte)255,0,1,(byte)255,(byte)217};
 mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(owner))
     .contentType(MediaType.APPLICATION_JSON).content(card().replace("MONTHLY","YEARLY")))
     .andExpect(status().isBadRequest());
 mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(owner))
     .contentType(MediaType.APPLICATION_JSON).content(card().replace("VISA","DINERS")))
     .andExpect(status().isBadRequest());
 mvc.perform(post("/api/billing/orders/card-preview").header("Authorization",auth(owner))
     .contentType(MediaType.APPLICATION_JSON).content(card().replace("\"country\":\"LK\"","\"country\":\"US\"")))
     .andExpect(status().isBadRequest());
 mvc.perform(slip(owner,jpeg,"image/png")).andExpect(status().isBadRequest());
 var result=mvc.perform(slip(owner,jpeg,"image/jpeg")).andExpect(status().isCreated())
     .andReturn().getResponse().getContentAsString();
 long id=json.readTree(result).path("id").asLong();
 mvc.perform(post("/api/billing/admin/orders/"+id+"/decision").header("Authorization",auth(admin))
     .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"REJECTED\",\"note\":\" \"}"))
     .andExpect(status().isBadRequest());
 mvc.perform(post("/api/billing/admin/orders/"+id+"/decision").header("Authorization",auth(admin))
     .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"REJECTED\",\"note\":\"Sample rejected\"}"))
     .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
 assertThat(billing.hasActivePremium(owner.getId())).isFalse();
 assertThat(payments.count()).isZero();
 mvc.perform(post("/api/billing/admin/orders/"+id+"/decision").header("Authorization",auth(admin))
     .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVED\"}"))
     .andExpect(status().isConflict());
 }
 }
