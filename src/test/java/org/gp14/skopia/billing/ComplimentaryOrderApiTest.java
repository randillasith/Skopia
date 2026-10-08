package org.gp14.skopia.billing;

import org.gp14.skopia.mail.BillingMailOutboxRepository;
import org.gp14.skopia.mail.BillingMailService;
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

import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@TestPropertySource(properties="skopia.billing.demo-enabled=true") @Transactional
class ComplimentaryOrderApiTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired PaymentRepository payments;
    @Autowired BillingOrderRepository orders;
    @Autowired BillingMailOutboxRepository outbox;
    @Autowired TokenService tokens;

    private String payload() { return "{\"planName\":\"MONTHLY\",\"billing\":{\"fullName\":\"Ada Viewer\",\"email\":\"ada@example.test\",\"phone\":\"0771234567\",\"addressLine1\":\"Main Street\",\"city\":\"Colombo\",\"postalCode\":\"00100\",\"country\":\"LK\"}}"; }
    private RegisteredViewer viewer() {
        var v=new RegisteredViewer(); v.setUsername("complimentary"+UUID.randomUUID().toString().replace("-", ""));
        v.setEmail(v.getUsername()+"@example.test"); v.setPasswordHash("test-only-hash");
        return viewers.saveAndFlush(v);
    }
    private String auth(RegisteredViewer v) { return "Bearer "+tokens.issue(v.getId()); }
    private String luhnNumber(String prefix, int length) {
        String body=prefix+"0".repeat(length-prefix.length()-1);
        for(int check=0;check<10;check++) {
            String digits=body+check;
            int sum=0;
            for(int i=digits.length()-1,position=0;i>=0;i--,position++) {
                int digit=digits.charAt(i)-'0';
                if(position%2==1) { digit*=2; if(digit>9) digit-=9; }
                sum+=digit;
            }
            if(sum%10==0) return digits;
        }
        throw new IllegalStateException("Could not generate checksum");
    }

    @Test void rejectsPanLikeSequencesAcrossNetworksAndContactFieldsWithoutEchoOrWrites() throws Exception {
        var v=viewer();
        for(String number : new String[]{luhnNumber("6011",16),luhnNumber("34",15),
                luhnNumber("4",16),luhnNumber("51",16),luhnNumber("9",13),luhnNumber("9",19)}) {
            for(String field : new String[]{"fullName","email","phone","addressLine1","addressLine2","city","postalCode"}) {
                String leak=field.equals("email")?"user"+number+"@example.test":
                        field.equals("phone")?number:"Unit "+number;
                var body=new com.fasterxml.jackson.databind.ObjectMapper().readTree(payload());
                ((com.fasterxml.jackson.databind.node.ObjectNode)body.get("billing")).put(field,leak);
                mvc.perform(post("/api/billing/orders/complimentary").header("Authorization",auth(v))
                        .contentType(MediaType.APPLICATION_JSON).content(body.toString()))
                    .andExpect(status().isBadRequest())
                    .andExpect(result->assertThat(result.getResponse().getContentAsString()).doesNotContain(number));
            }
        }
        String grouped=luhnNumber("6011",16).replaceAll("(.{4})(?!$)","$1-");
        mvc.perform(post("/api/billing/orders/complimentary").header("Authorization",auth(v))
                .contentType(MediaType.APPLICATION_JSON).content(payload().replace("Main Street",grouped)))
            .andExpect(status().isBadRequest());
        assertThat(orders.findByOwnerIdOrderBySubmittedAtDescIdDesc(v.getId())).isEmpty();
        assertThat(subscriptions.findByViewerId(v.getId())).isEmpty();
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(v.getId())).isEmpty();
        mvc.perform(post("/api/billing/orders/complimentary").header("Authorization",auth(v))
                .contentType(MediaType.APPLICATION_JSON).content(payload()))
            .andExpect(status().isCreated());
    }

    @Test void activationHasZeroDueNoPaymentOneEntitlementAndCancellableStatus() throws Exception {
        var v=viewer();
        mvc.perform(post("/api/billing/orders/complimentary").header("Authorization",auth(v))
                .contentType(MediaType.APPLICATION_JSON).content(payload()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.method").value("COMPLIMENTARY"))
                .andExpect(jsonPath("$.status").value("NO_CHARGE_ACTIVE"))
                .andExpect(jsonPath("$.amount").value(0)).andExpect(jsonPath("$.currency").value("LKR"))
                .andExpect(jsonPath("$.paymentId").doesNotExist()).andExpect(jsonPath("$.brand").doesNotExist())
                .andExpect(jsonPath("$.simulation").value(false));
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(v.getId())).isEmpty();
        var subscription=subscriptions.findByViewerId(v.getId()).get(0);
        assertThat(subscription.getAutoRenew()).isFalse();
        assertThat(ChronoUnit.DAYS.between(subscription.getStartDate(),subscription.getEndDate())).isEqualTo(30);
        mvc.perform(post("/api/billing/orders/complimentary").header("Authorization",auth(v))
                .contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isConflict());
        assertThat(subscriptions.findByViewerId(v.getId())).hasSize(1);
        mvc.perform(post("/api/billing/cancel").header("Authorization",auth(v)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.premium").value(false));
        assertThat(orders.findByOwnerIdOrderBySubmittedAtDescIdDesc(v.getId())).hasSize(1);
    }
    @Test void rejectsCredentialsAtTopLevelOrNestedAndRequiresBillingEmail() throws Exception {
        var v=viewer();
        for (String body : new String[]{
                payload().replaceFirst("\\{", "{\"cardNumber\":\"4111\","),
                payload().replaceFirst("\\{", "{\"brand\":\"VISA\","),
                payload().replaceFirst("\\{", "{\"expiry\":\"12/30\","),
                payload().replace("\"country\":\"LK\"", "\"country\":\"LK\",\"cvv\":\"123\""),
                payload().replace("ada@example.test", "bad-address")}) {
            mvc.perform(post("/api/billing/orders/complimentary").header("Authorization",auth(v))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        assertThat(orders.findByOwnerIdOrderBySubmittedAtDescIdDesc(v.getId())).isEmpty();
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(v.getId())).isEmpty();
    }
    @Test void receiptQueuedForContactAndMainWithPriceSeparateFromDue() throws Exception {
        var v=viewer();
        mvc.perform(post("/api/billing/orders/complimentary").header("Authorization",auth(v))
                .contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isCreated());
        var order=orders.findByOwnerIdOrderBySubmittedAtDescIdDesc(v.getId()).get(0);
        var rows=outbox.findAll().stream().filter(r->r.getEventKey().equals("COMPLIMENTARY_RECEIPT:"+order.getId())).toList();
        assertThat(rows).hasSize(2).extracting(r->r.getRecipient())
                .containsExactlyInAnyOrder("ada@example.test",BillingMailService.MAIN_ADMIN_RECIPIENT);
        assertThat(rows).allSatisfy(r->{
            assertThat(r.getSubject()).contains("complimentary");
            assertThat(r.getBody()).contains("Listed monthly price: LKR 500", "Amount due: LKR 0", "no payment was made", "no automatic renewal");
            assertThat(r.getBody()).doesNotContain("charged LKR 500", "paid LKR 500", "test card");
        });
    }
}
