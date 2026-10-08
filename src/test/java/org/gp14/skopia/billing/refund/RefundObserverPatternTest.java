package org.gp14.skopia.billing.refund;

import org.gp14.skopia.mail.BillingMailService;
import org.gp14.skopia.model.subscription.Payment;
import org.gp14.skopia.model.subscription.Refund;
import org.gp14.skopia.model.subscription.RefundStatus;
import org.gp14.skopia.model.subscription.Subscription;
import org.gp14.skopia.model.user.ActivityLog;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.notification.NotificationService;
import org.gp14.skopia.repository.ActivityLogRepository;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.user.StaffRoleService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class RefundObserverPatternTest {

    @Test
    void subjectNotifiesEveryRegisteredObserverExactlyOnce() {
        RefundStatusObserver first = mock(RefundStatusObserver.class);
        RefundStatusObserver second = mock(RefundStatusObserver.class);
        RefundEventSubject subject = new RefundStatusPublisher(List.of(first, second));
        RefundStatusChangedEvent event = event(RefundStatus.PENDING, RefundStatus.APPROVED);

        subject.notifyObservers(event);

        verify(first).onRefundStatusChanged(event);
        verify(second).onRefundStatusChanged(event);
        verifyNoMoreInteractions(first, second);
    }

    @Test
    void mailObserverQueuesTheRefundSnapshot() {
        BillingMailService mail = mock(BillingMailService.class);
        RefundMailObserver observer = new RefundMailObserver(mail);
        RefundStatusChangedEvent event = event(null, RefundStatus.PENDING);

        observer.onRefundStatusChanged(event);

        verify(mail).refund(event.refund());
    }

    @Test
    void notificationObserverNotifiesRequesterAndActiveAdministratorsForNewRequest() {
        NotificationService notifications = mock(NotificationService.class);
        UserRepository users = mock(UserRepository.class);
        StaffRoleService staffRoles = mock(StaffRoleService.class);
        RefundNotificationObserver observer = new RefundNotificationObserver(notifications, users, staffRoles);
        RefundStatusChangedEvent event = event(null, RefundStatus.PENDING);
        Administrator activeAdmin = administrator(20L, "ACTIVE");
        Administrator inactiveAdmin = administrator(21L, "INACTIVE");
        when(users.findAll()).thenReturn(List.of(activeAdmin, inactiveAdmin));
        when(staffRoles.hasRole(eq(20L), any())).thenReturn(true);
        when(staffRoles.hasRole(eq(21L), any())).thenReturn(true);

        observer.onRefundStatusChanged(event);

        verify(notifications).create(eq(event.owner()), eq("Refund request received"),
                eq("Your simulated refund request is pending review."), eq("REFUND_REQUESTED"),
                eq("/billing"), eq("REFUND_REQUESTED:100"));
        verify(notifications).create(eq(activeAdmin), eq("New refund request"),
                eq("refund_viewer submitted a simulated refund request."), eq("REFUND_ADMIN_NEW"),
                eq("/admin/refunds"), eq("REFUND_ADMIN_NEW:100"));
        verify(notifications, never()).create(eq(inactiveAdmin), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void activityObserverRecordsAdministratorDecisionOnlyForTerminalReviewDecisions() {
        ActivityLogRepository logs = mock(ActivityLogRepository.class);
        RefundActivityObserver observer = new RefundActivityObserver(logs);
        RefundStatusChangedEvent approved = event(RefundStatus.PENDING, RefundStatus.APPROVED);

        observer.onRefundStatusChanged(approved);
        observer.onRefundStatusChanged(event(null, RefundStatus.PENDING));

        verify(logs, times(1)).save(argThat(log ->
                log.getActor().equals(approved.actor())
                        && log.getTargetUser().equals(approved.owner())
                        && "SIMULATED_REFUND_APPROVED".equals(log.getActionType())
                        && log.getDetail().contains("refund=100 APPROVED")
                        && log.getDetail().contains("payment=200")
        ));
    }

    private RefundStatusChangedEvent event(RefundStatus previous, RefundStatus current) {
        RegisteredViewer owner = new RegisteredViewer();
        owner.setId(10L);
        owner.setUsername("refund_viewer");
        owner.setEmail("refund-viewer@example.test");
        owner.setAccountStatus("ACTIVE");

        Administrator actor = administrator(30L, "ACTIVE");

        Subscription subscription = new Subscription();
        subscription.setViewer(owner);
        Payment payment = new Payment();
        payment.setId(200L);
        payment.setSubscription(subscription);
        Refund refund = new Refund();
        refund.setId(100L);
        refund.setPayment(payment);
        refund.setRefundStatus(current);
        return new RefundStatusChangedEvent(refund, previous, current, actor);
    }

    private Administrator administrator(Long id, String status) {
        Administrator admin = new Administrator();
        admin.setId(id);
        admin.setUsername("admin_" + id);
        admin.setEmail("admin" + id + "@example.test");
        admin.setAccountStatus(status);
        return admin;
    }
}
