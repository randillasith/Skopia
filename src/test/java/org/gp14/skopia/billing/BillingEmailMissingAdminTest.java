package org.gp14.skopia.billing;

import org.gp14.skopia.mail.*;
import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest @ActiveProfiles("test")
@TestPropertySource(properties={"skopia.billing.demo-enabled=true", "skopia.billing.legacy-orders-enabled=true", "skopia.mail.enabled=true", "skopia.mail.cron=-",
        "skopia.mail.from=sender@example.test", "skopia.mail.host=mail.example.test",
        "skopia.mail.username=test-user", "skopia.mail.password=test-only",
        "skopia.mail.main-admin-username=billing-mail-test-admin"})
class BillingEmailMissingAdminTest {
    @Autowired SimulatedOrderService orders;
    @Autowired BillingMailOutboxRepository outbox;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired AdministratorRepository admins;
    @Autowired UserRepository users;
    @Autowired BillingMailDispatcher dispatcher;
    @MockitoBean(name="billingMailSender") JavaMailSender sender;

    @Test void absentConfiguredMainIsRetriedAndResolvedAfterCreation() {
        assertThat(users.findByUsername("billing-mail-test-admin")).isEmpty();
        String key=UUID.randomUUID().toString().replace("-", "");
        RegisteredViewer viewer=new RegisteredViewer();
        viewer.setUsername("missingadmin"+key); viewer.setEmail("viewer"+key+"@example.test");
        viewer.setPasswordHash("test-only-hash"); viewers.saveAndFlush(viewer);
        var contact=new BillingDtos.BillingContact("Test Viewer", "billing"+key+"@example.test",
                "0771234567", "Test Street", null, "Colombo", "00100", "LK");
        var order=orders.noChargeCard(viewer.getId(),"MONTHLY","VISA",contact);
        var row=outbox.findAll().stream().filter(r->r.getEventKey().equals("NO_CHARGE_RECEIPT:"+order.id())
                && r.getRecipient().equals(BillingMailService.MAIN_ADMIN_RECIPIENT)).findFirst().orElseThrow();
        dispatcher.dispatch();
        row=outbox.findById(row.getId()).orElseThrow();
        assertThat(row.getStatus()).isEqualTo("PENDING");
        assertThat(row.getAttempts()).isZero();
        assertThat(row.getLastError()).isEqualTo("Main administrator unavailable");
        var subscriberMail=org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender,times(1)).send(subscriberMail.capture());
        assertThat(subscriberMail.getValue().getTo()).containsExactly(contact.email());
        var admin=new Administrator(); admin.setUsername("billing-mail-test-admin");
        admin.setEmail("newadmin"+key+"@example.test"); admin.setPasswordHash("test-only-hash");
        admin.setDesignation("Administrator"); admin.setHireDate(LocalDate.now()); admin.setAdminLevel("MAIN");
        admins.saveAndFlush(admin);
        row.setNextAttemptAt(LocalDateTime.now().minusSeconds(1)); outbox.saveAndFlush(row);
        reset(sender);
        dispatcher.dispatch();
        assertThat(outbox.findById(row.getId()).orElseThrow().getStatus()).isEqualTo("SENT");
        var captured=org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender,times(1)).send(captured.capture());
        assertThat(captured.getValue().getTo()).containsExactly(admin.getEmail());
        dispatcher.dispatch();
        verify(sender,times(1)).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }
}
