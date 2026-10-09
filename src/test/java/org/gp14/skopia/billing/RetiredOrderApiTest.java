package org.gp14.skopia.billing;

import org.gp14.skopia.model.user.RegisteredViewer;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@TestPropertySource(properties="skopia.billing.demo-enabled=true") @Transactional
class RetiredOrderApiTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired BillingOrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired TokenService tokens;

    @Test void legacyCreationIsGoneByDefaultWhileComplimentaryStillWorks() throws Exception {
        var v=new RegisteredViewer(); v.setUsername("retired"+UUID.randomUUID().toString().replace("-", ""));
        v.setEmail(v.getUsername()+"@example.test"); v.setPasswordHash("test-only-hash");
        v=viewers.saveAndFlush(v);
        String bearer="Bearer "+tokens.issue(v.getId());
        String contact="{\"fullName\":\"Example Person\",\"email\":\"example@example.test\",\"phone\":\"0771234567\",\"addressLine1\":\"Example Street\",\"city\":\"Colombo\",\"postalCode\":\"00100\",\"country\":\"LK\"}";
        String legacy="{\"planName\":\"MONTHLY\",\"brand\":\"VISA\",\"billing\":"+contact+"}";
        for(String route : new String[]{"card-preview","no-charge-card"}) {
            mvc.perform(post("/api/billing/orders/"+route).header("Authorization",bearer)
                    .contentType(MediaType.APPLICATION_JSON).content(legacy))
                .andExpect(status().isGone());
        }
        mvc.perform(multipart("/api/billing/orders/bank-transfer")
                .file(new MockMultipartFile("slip","sample.png","image/png",new byte[]{1,2,3}))
                .param("planName","MONTHLY").param("billing",contact).header("Authorization",bearer))
            .andExpect(status().isGone());
        assertThat(orders.findByOwnerIdOrderBySubmittedAtDescIdDesc(v.getId())).isEmpty();
        assertThat(subscriptions.findByViewerId(v.getId())).isEmpty();
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(v.getId())).isEmpty();
        mvc.perform(post("/api/billing/orders/complimentary").header("Authorization",bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"planName\":\"MONTHLY\",\"billing\":"+contact+"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value(0));
        assertThat(payments.findBySubscriptionViewerIdOrderByPaidDatetimeDescIdDesc(v.getId())).isEmpty();
        assertThat(subscriptions.findByViewerId(v.getId())).hasSize(1);
    }
}
