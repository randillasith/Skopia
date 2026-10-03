package org.gp14.skopia.billing;

import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.PaymentRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class BillingDisabledTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired PaymentRepository payments;
    @Autowired TokenService tokens;

    @Test void disabledByDefaultAndDoesNotCreatePayment() throws Exception {
        RegisteredViewer v = new RegisteredViewer();
        v.setUsername("disabledBilling"); v.setEmail("disabled-billing@example.test");
        v.setPasswordHash("test-only-hash");
        v = viewers.saveAndFlush(v);
        mvc.perform(get("/api/billing/plans"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.demoEnabled").value(false));
        mvc.perform(post("/api/billing/checkout")
                .header("Authorization", "Bearer " + tokens.issue(v.getId()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"planName\":\"MONTHLY\"}"))
                .andExpect(status().isServiceUnavailable());
        assertThat(payments.count()).isZero();
    }
}
