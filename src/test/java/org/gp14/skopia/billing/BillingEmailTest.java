package org.gp14.skopia.billing;

import org.gp14.skopia.mail.*;
import org.gp14.skopia.model.subscription.*;
import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest @ActiveProfiles("test")
@TestPropertySource(properties={"skopia.billing.demo-enabled=true", "skopia.billing.legacy-orders-enabled=true", "skopia.mail.enabled=true", "skopia.mail.cron=-", "skopia.mail.from=sender@example.test", "skopia.mail.host=mail.example.test", "skopia.mail.username=test-user", "skopia.mail.password=test-only"})
class BillingEmailTest {
    @Autowired SimulatedOrderService orders;
    @Autowired BillingService billing;
    @Autowired BillingMailOutboxRepository outbox;
    @Autowired BillingMailService mail;
    @Autowired BillingOrderRepository orderRepository;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired AdministratorRepository admins;
    @Autowired UserRepository users;
    @Autowired TransactionTemplate transactions;
    @Autowired BillingMailDispatcher dispatcher;
    @MockitoBean(name="billingMailSender") JavaMailSender sender;
    @Autowired BillingMailClaims claims;

    private RegisteredViewer viewer(String suffix) {
        var v=new RegisteredViewer(); v.setUsername("mailviewer"+suffix); v.setEmail("viewer"+suffix+"@example.test");
        v.setPasswordHash("test-only-hash"); return viewers.saveAndFlush(v);
    }
    private Administrator admin(String username) {
        var a=new Administrator(); a.setUsername(username); a.setEmail("admin"+UUID.randomUUID()+"@example.test");
        a.setPasswordHash("test-only-hash"); a.setDesignation("Administrator"); a.setHireDate(LocalDate.now());
        a.setAdminLevel("MAIN"); return admins.saveAndFlush(a);
    }
    private Administrator main() {
        var a=(Administrator) users.findByUsername("main").orElseGet(()->admin("main"));
        a.setAccountStatus("ACTIVE"); return admins.saveAndFlush(a);
    }
    @AfterEach void deactivateMain() { users.findByUsername("main").ifPresent(u->{u.setAccountStatus("INACTIVE");users.saveAndFlush(u);}); }
    private BillingDtos.BillingContact contact(String email) {
        return new BillingDtos.BillingContact("Test Viewer", email, "0771234567", "Test Street", null, "Colombo", "00100", "LK");
    }
    @Test void complimentaryReceiptDispatchesToAccountBillingContactAndCurrentMainWithoutPaidClaims() {
        String key=UUID.randomUUID().toString().replace("-", "");
        var admin=main();
        var v=viewer(key);
        String billingAddress="billing"+key+"@example.test";
        var order=orders.complimentary(v.getId(),"MONTHLY",contact(billingAddress));
        reset(sender);
        dispatcher.dispatch();
        var rows=outbox.findAll().stream().filter(r->r.getEventKey().equals("COMPLIMENTARY_RECEIPT:"+order.id())).toList();
        assertThat(rows).hasSize(3).allSatisfy(r->assertThat(r.getStatus()).isEqualTo("SENT"));
        var captured=org.mockito.ArgumentCaptor.forClass(org.springframework.mail.SimpleMailMessage.class);
        verify(sender,atLeast(3)).send(captured.capture());
        var current=captured.getAllValues().stream().filter(m->m.getText().contains(order.reference())).toList();
        assertThat(current).hasSize(3);
        assertThat(current).anySatisfy(m->assertThat(m.getTo()).containsExactly(v.getEmail()));
        assertThat(current).anySatisfy(m->assertThat(m.getTo()).containsExactly(billingAddress));
        assertThat(current).anySatisfy(m->assertThat(m.getTo()).containsExactly(admin.getEmail()));
        assertThat(current).allSatisfy(m->{
            assertThat(m.getSubject()).contains("complimentary");
            assertThat(m.getText()).contains("Listed monthly price: LKR 500", "Amount due: LKR 0");
            assertThat(m.getText()).doesNotContain("test card", "charged LKR 500", "paid LKR 500");
        });
    }
    @Test void matchingAccountAndBillingEmailsQueueOnlyOneSubscriberCopy() {
        String key=UUID.randomUUID().toString().replace("-", "");
        var v=viewer(key);
        var order=orders.complimentary(v.getId(),"MONTHLY",contact(v.getEmail().toUpperCase(java.util.Locale.ROOT)));
        var rows=outbox.findAll().stream().filter(r->r.getEventKey().equals("COMPLIMENTARY_RECEIPT:"+order.id())).toList();
        assertThat(rows).hasSize(2).extracting(BillingMailOutbox::getRecipient)
                .containsExactlyInAnyOrder(v.getEmail(),BillingMailService.MAIN_ADMIN_RECIPIENT);
    }
    @Test void corruptStoredRequesterEmailDoesNotRollBackRefund() {
        String key=UUID.randomUUID().toString().replace("-", "");
        var v=viewer(key);
        var order=orders.card(v.getId(),"MONTHLY","VISA",contact("legacy"+key+"@example.test"));
        v.setEmail("invalid\nrecipient@example.test"); viewers.saveAndFlush(v);
        var refund=refundFor(v,order.paymentId());
        assertThat(refund.status()).isEqualTo(RefundStatus.PENDING);
        var rows=outbox.findAll().stream().filter(r->r.getEventKey().equals("REFUND_PENDING:"+refund.id())).toList();
        assertThat(rows).hasSize(2);
        assertThat(rows).anySatisfy(r->{
            assertThat(r.getRecipient()).isEqualTo(BillingMailService.INVALID_REQUESTER_RECIPIENT);
            assertThat(r.getStatus()).isEqualTo("FAILED");
            assertThat(r.getLastError()).isEqualTo("Invalid stored requester email");
            assertThat(r.getAttempts()).isZero();
        });
        assertThat(rows).noneMatch(r->r.getRecipient().contains("invalid"));
        dispatcher.dispatch();
        var captured=org.mockito.ArgumentCaptor.forClass(org.springframework.mail.SimpleMailMessage.class);
        verify(sender,atMostOnce()).send(captured.capture());
        assertThat(captured.getAllValues()).noneMatch(m->java.util.Arrays.stream(m.getTo()).anyMatch(to->to.contains("invalid")));
    }
    @Test void unavailableAdminBacklogDoesNotStarveSubscriber() {
        String key=UUID.randomUUID().toString().replace("-", "");
        for(int i=0;i<26;i++) {
            var row=new BillingMailOutbox(); row.setEventKey("BACKLOG:"+key+":"+i);
            row.setRecipient(BillingMailService.MAIN_ADMIN_RECIPIENT);
            row.setSubject("Backlog"); row.setBody("Backlog");
            row.setNextAttemptAt(java.time.LocalDateTime.now().minusDays(2)); outbox.saveAndFlush(row);
        }
        var v=viewer(key);
        var order=orders.noChargeCard(v.getId(),"MONTHLY","VISA",contact("billing"+key+"@example.test"));
        dispatcher.dispatch();
        var row=outbox.findAll().stream().filter(r->r.getEventKey().equals("NO_CHARGE_RECEIPT:"+order.id())
                && r.getRecipient().equals("billing"+key+"@example.test")).findFirst().orElseThrow();
        assertThat(row.getStatus()).isEqualTo("SENT");
    }
    @Test void expiredLeaseCanBeReclaimedButOldCompletionCannotOverrideNewClaim() {
        var row=new BillingMailOutbox(); row.setEventKey("LEASE:"+UUID.randomUUID());
        row.setRecipient("lease@example.test"); row.setSubject("Lease"); row.setBody("Lease");
        row=outbox.saveAndFlush(row);
        var first=claims.claim(row.getId());
        assertThat(claims.claim(row.getId())).isNull();
        row=outbox.findById(row.getId()).orElseThrow();
        row.setNextAttemptAt(java.time.LocalDateTime.now().minusSeconds(1)); outbox.saveAndFlush(row);
        var second=claims.claim(row.getId());
        assertThat(second).isNotNull();
        assertThat(second.token()).isNotEqualTo(first.token());
        claims.complete(first,true);
        assertThat(outbox.findById(row.getId()).orElseThrow().getStatus()).isEqualTo("SENDING");
        claims.complete(second,true);
        assertThat(outbox.findById(row.getId()).orElseThrow().getStatus()).isEqualTo("SENT");
        assertThat(outbox.findById(row.getId()).orElseThrow().getAttempts()).isEqualTo(2);
    }
    @Test void concurrentClaimsDoNotIssueTwoTokensForOneDueRow() throws Exception {
        var row=new BillingMailOutbox(); row.setEventKey("CONCURRENT:"+UUID.randomUUID());
        row.setRecipient("concurrent@example.test"); row.setSubject("Claim"); row.setBody("Claim");
        Long id=outbox.saveAndFlush(row).getId();
        var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
        var start=new java.util.concurrent.CountDownLatch(1);
        try {
            java.util.concurrent.Callable<BillingMailClaims.Claimed> task=()->{start.await();return claims.claim(id);};
            var first=pool.submit(task); var second=pool.submit(task);
            start.countDown();
            var results=java.util.List.of(first,second);
            int accepted=0;
            for(var result:results) if(result.get(10,java.util.concurrent.TimeUnit.SECONDS)!=null) accepted++;
            assertThat(accepted).isEqualTo(1);
            assertThat(outbox.findById(id).orElseThrow().getAttempts()).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void receiptPersistsForBillingAddressAndActiveMainOnlyAndNeverOnRollback() {
        String key=UUID.randomUUID().toString().replace("-", "");
        var v=viewer(key); var main=main(); admin("other"+key);
            var order=orders.noChargeCard(v.getId(),"MONTHLY","VISA",contact("billing"+key+"@example.test"));
            var rows=outbox.findAll().stream().filter(r->r.getEventKey().equals("NO_CHARGE_RECEIPT:"+order.id())).toList();
            assertThat(rows).hasSize(3);
            assertThat(rows).extracting(BillingMailOutbox::getRecipient).containsExactlyInAnyOrder(v.getEmail(),"billing"+key+"@example.test",BillingMailService.MAIN_ADMIN_RECIPIENT);
            assertThat(rows).allSatisfy(r->{assertThat(r.getBody()).contains("LKR 0",order.reference(),"No payment", "30-day"); assertThat(r.getAttempts()).isZero();});
            transactions.executeWithoutResult(s->mail.receipt(orderRepository.findById(order.id()).orElseThrow()));
            assertThat(outbox.findAll().stream().filter(r->r.getEventKey().equals("NO_CHARGE_RECEIPT:"+order.id()))).hasSize(3);
            assertThat(order.paymentId()).isNull();
            assertThat(billing.payments(v.getId())).isEmpty();
            verifyNoInteractions(sender);
            assertThatThrownBy(()->transactions.executeWithoutResult(s->{orders.noChargeCard(viewer(UUID.randomUUID().toString().replace("-", "")).getId(),"MONTHLY","VISA",contact("rollback@example.test")); s.setRollbackOnly(); throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
            assertThat(outbox.findAll()).noneMatch(r->"rollback@example.test".equals(r.getRecipient()));
            verifyNoInteractions(sender);

    }
    @Test void smtpFailureIsIsolatedAndBounded() {
        String key=UUID.randomUUID().toString().replace("-", "");
        var v=viewer(key); var o=orders.noChargeCard(v.getId(),"MONTHLY","VISA",contact("retry"+key+"@example.test"));
        doThrow(new IllegalStateException("secret must not persist")).when(sender).send(any(org.springframework.mail.SimpleMailMessage.class));
        dispatcher.dispatch();
        var row=outbox.findAll().stream().filter(r->r.getEventKey().equals("NO_CHARGE_RECEIPT:"+o.id())).findFirst().orElseThrow();
        assertThat(row.getAttempts()).isEqualTo(1);
        assertThat(row.getStatus()).isEqualTo("PENDING");
        assertThat(row.getLastError()).doesNotContain("secret");
        row.setAttempts(3); row.setNextAttemptAt(java.time.LocalDateTime.now().minusSeconds(1)); outbox.saveAndFlush(row);
        dispatcher.dispatch();
        row=outbox.findById(row.getId()).orElseThrow();
        assertThat(row.getStatus()).isEqualTo("FAILED");
        assertThat(row.getAttempts()).isEqualTo(4);
        dispatcher.dispatch();
        assertThat(outbox.findById(row.getId()).orElseThrow().getAttempts()).isEqualTo(4);
        reset(sender);
        Long failedId=row.getId();
        main();
        var other=outbox.findAll().stream().filter(r->r.getEventKey().equals("NO_CHARGE_RECEIPT:"+o.id()) && !r.getId().equals(failedId)).findFirst();
        if(other.isPresent()) {
            var pending=other.orElseThrow(); pending.setNextAttemptAt(java.time.LocalDateTime.now().minusSeconds(1)); outbox.saveAndFlush(pending);
            dispatcher.dispatch();
            assertThat(outbox.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo("SENT");
        }
    }
    @Test void refundStagesProduceCandidMessagesToRequesterAndMain() {
        String key=UUID.randomUUID().toString().replace("-", "");
        var main=main(); var v=viewer(key);
        var order=orders.card(v.getId(),"MONTHLY","VISA",contact("legacy"+key+"@example.test"));
        var requested=refundFor(v,order.paymentId());
        assertRefundMail(requested.id(),"PENDING",v.getEmail(),"LKR 500.00");
        billing.cancelRefund(v.getId(),requested.id());
        assertRefundMail(requested.id(),"CANCELLED",v.getEmail(),"No real money");
        assertThatThrownBy(()->billing.cancelRefund(v.getId(),requested.id())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        var rejectedViewer=viewer("reject"+key);
        var rejectOrder=orders.card(rejectedViewer.getId(),"MONTHLY","VISA",contact("legacyreject"+key+"@example.test"));
        var reject=refundFor(rejectedViewer,rejectOrder.paymentId());
        billing.decideRefund(main,reject.id(),RefundStatus.REJECTED,"Not eligible for approval");
        assertRefundMail(reject.id(),"REJECTED",rejectedViewer.getEmail(),"LKR 500.00");
        var approvedViewer=viewer("approve"+key);
        var approveOrder=orders.card(approvedViewer.getId(),"MONTHLY","VISA",contact("legacyapprove"+key+"@example.test"));
        var approve=refundFor(approvedViewer,approveOrder.paymentId());
        billing.decideRefund(main,approve.id(),RefundStatus.APPROVED,null);
        assertRefundMail(approve.id(),"APPROVED",approvedViewer.getEmail(),"No real money");
        assertThat(outbox.findAll()).noneMatch(r->r.getBody().contains("test-only-hash"));
    }
    private BillingDtos.RefundView refundFor(RegisteredViewer v,Long paymentId) {
        return billing.requestRefund(v.getId(),paymentId,new BillingDtos.RefundRequest(null,RefundCategory.ACCIDENTAL_PURCHASE,"Selected wrong preview plan"));
    }
    private void assertRefundMail(Long id,String state,String requester,String detail) {
        var rows=outbox.findAll().stream().filter(r->r.getEventKey().equals("REFUND_"+state+":"+id)).toList();
        assertThat(rows).hasSize(2).extracting(BillingMailOutbox::getRecipient).containsExactlyInAnyOrder(requester,BillingMailService.MAIN_ADMIN_RECIPIENT);
        assertThat(rows).allSatisfy(r->assertThat(r.getBody()).contains("Refund ID: "+id,"Status: "+state,detail));
    }
    @Test void refundFreeTextNeverReachesOutboxOrSmtp() {
        String key=UUID.randomUUID().toString().replace("-", "");
        var a=main(); var v=viewer(key);
        var order=orders.card(v.getId(),"MONTHLY","VISA",contact("legacy"+key+"@example.test"));
        String reason="Transfer to GB82WEST" + "1".repeat(14) + " or account AB12CD34EF56";
        var refund=billing.requestRefund(v.getId(),order.paymentId(),
                new BillingDtos.RefundRequest(null,RefundCategory.ACCIDENTAL_PURCHASE,reason));
        String note="Reject: LK12BANKABCD987654321 and swift ABCDLKLX";
        billing.decideRefund(a,refund.id(),RefundStatus.REJECTED,note);
        var rows=outbox.findAll().stream().filter(r->r.getEventKey().endsWith(":"+refund.id()) && r.getEventKey().startsWith("REFUND_")).toList();
        assertThat(rows).hasSize(4).allSatisfy(r->{
            assertThat(r.getBody()).contains("Category: ACCIDENTAL_PURCHASE", "Log in to Skopia", "No real money");
            assertThat(r.getBody()).doesNotContain(reason,note,"GB82WEST", "AB12CD34", "LK12BANK", "ABCDLKLX");
        });
        dispatcher.dispatch();
        org.mockito.ArgumentCaptor<org.springframework.mail.SimpleMailMessage> captured=org.mockito.ArgumentCaptor.forClass(org.springframework.mail.SimpleMailMessage.class);
        verify(sender,atLeastOnce()).send(captured.capture());
        assertThat(captured.getAllValues()).allSatisfy(m->assertThat(m.getText()).doesNotContain(reason,note,"GB82WEST", "AB12CD34", "LK12BANK", "ABCDLKLX"));
    }
    @Test void adminCopyRemainsPendingWithoutMainThenUsesCurrentActiveAddressExactlyOnce() {
        users.findByUsername("main").ifPresent(u->{u.setAccountStatus("INACTIVE");users.saveAndFlush(u);});
        String key=UUID.randomUUID().toString().replace("-", "");
        var v=viewer(key);
        var order=orders.noChargeCard(v.getId(),"MONTHLY","VISA",contact("billing"+key+"@example.test"));
        String event="NO_CHARGE_RECEIPT:"+order.id();
        var adminRow=outbox.findAll().stream().filter(r->r.getEventKey().equals(event) && r.getRecipient().equals(BillingMailService.MAIN_ADMIN_RECIPIENT)).findFirst().orElseThrow();
        dispatcher.dispatch();
        adminRow=outbox.findById(adminRow.getId()).orElseThrow();
        assertThat(adminRow.getStatus()).isEqualTo("PENDING");
        assertThat(adminRow.getAttempts()).isZero();
        assertThat(adminRow.getLastError()).isEqualTo("Main administrator unavailable");
        var a=main();
        String original=a.getEmail();
        String updated="updated"+key+"@example.test";
        a.setEmail(updated); admins.saveAndFlush(a);
        adminRow.setNextAttemptAt(java.time.LocalDateTime.now().minusSeconds(1)); outbox.saveAndFlush(adminRow);
        reset(sender);
        dispatcher.dispatch();
        assertThat(outbox.findById(adminRow.getId()).orElseThrow().getStatus()).isEqualTo("SENT");
        var captured=org.mockito.ArgumentCaptor.forClass(org.springframework.mail.SimpleMailMessage.class);
        verify(sender,atLeastOnce()).send(captured.capture());
        assertThat(captured.getAllValues()).anySatisfy(message -> assertThat(message.getTo()).containsExactly(updated));
        assertThat(captured.getAllValues()).allSatisfy(message -> assertThat(message.getTo()).doesNotContain(original,BillingMailService.MAIN_ADMIN_RECIPIENT));
        int sendCount=captured.getAllValues().size();
        dispatcher.dispatch();
        verify(sender,times(sendCount)).send(any(org.springframework.mail.SimpleMailMessage.class));
    }
}
