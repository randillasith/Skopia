package org.gp14.skopia.billing.refund;

import org.gp14.skopia.model.subscription.RefundStatus;
import org.gp14.skopia.model.user.StaffType;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.notification.NotificationService;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.user.StaffRoleService;
import org.springframework.stereotype.Component;

/** Concrete observer responsible only for requester and administrator notifications. */
@Component
public class RefundNotificationObserver implements RefundStatusObserver {
    private final NotificationService notifications;
    private final UserRepository users;
    private final StaffRoleService staffRoles;

    public RefundNotificationObserver(NotificationService notifications, UserRepository users,
                                      StaffRoleService staffRoles) {
        this.notifications = notifications;
        this.users = users;
        this.staffRoles = staffRoles;
    }

    @Override
    public void onRefundStatusChanged(RefundStatusChangedEvent event) {
        User owner = event.owner();
        Long refundId = event.refund().getId();
        switch (event.currentStatus()) {
            case PENDING -> {
                notifications.create(owner, "Refund request received",
                        "Your simulated refund request is pending review.", "REFUND_REQUESTED",
                        "/billing", "REFUND_REQUESTED:" + refundId);
                notifyActiveAdministrators("New refund request",
                        owner.getUsername() + " submitted a simulated refund request.",
                        "REFUND_ADMIN_NEW", "REFUND_ADMIN_NEW:" + refundId);
            }
            case CANCELLED -> {
                notifications.create(owner, "Refund request cancelled",
                        "Your simulated refund request was cancelled.", "REFUND_CANCELLED",
                        "/billing", "REFUND_CANCELLED:" + refundId);
                notifyActiveAdministrators("Refund request withdrawn",
                        owner.getUsername() + " cancelled a pending simulated refund request.",
                        "REFUND_ADMIN_CANCELLED", "REFUND_ADMIN_CANCELLED:" + refundId);
            }
            case APPROVED -> notifications.create(owner, "Refund request approved",
                    "Your simulated refund request was approved and the related entitlement was revoked.",
                    "REFUND_APPROVED", "/billing", "REFUND_APPROVED:" + refundId);
            case REJECTED -> notifications.create(owner, "Refund request rejected",
                    "Your simulated refund request was rejected. Note: " + event.refund().getDecisionNote(),
                    "REFUND_REJECTED", "/billing", "REFUND_REJECTED:" + refundId);
        }
    }

    private void notifyActiveAdministrators(String title, String body, String type, String dedupeKey) {
        for (User user : users.findAll()) {
            if ("ACTIVE".equals(user.getAccountStatus())
                    && staffRoles.hasRole(user.getId(), StaffType.ADMINISTRATOR)) {
                notifications.create(user, title, body, type, "/admin/refunds", dedupeKey);
            }
        }
    }
}
