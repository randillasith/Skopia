package org.gp14.skopia.billing;

import org.gp14.skopia.notification.NotificationService;
import org.gp14.skopia.repository.SubscriptionRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Durable in-app reminders; no email provider or automatic charge is implied. */
@Service
public class SubscriptionReminderService {
    private final SubscriptionRepository subscriptions;
    private final NotificationService notifications;

    public SubscriptionReminderService(SubscriptionRepository subscriptions, NotificationService notifications) {
        this.subscriptions = subscriptions;
        this.notifications = notifications;
    }

    @Scheduled(cron = "${skopia.billing.renewal-reminder-cron:0 0 9 * * *}")
    @Transactional
    public void sendUpcomingRenewalReminders() {
        sendUpcomingRenewalReminders(LocalDateTime.now());
    }

    @Transactional
    public void sendUpcomingRenewalReminders(LocalDateTime now) {
        for (var subscription : subscriptions.findBySubStatusAndEndDateAfterAndEndDateLessThanEqual("ACTIVE", now, now.plusDays(3))) {
            if (subscription.getStartDate().isAfter(now) || !"ACTIVE".equals(subscription.getViewer().getAccountStatus())) continue;
            notifications.create(subscription.getViewer(), "Your subscription expires soon",
                    "Your " + subscription.getPlan().getPlanName() + " subscription expires on " + subscription.getEndDate()
                            + ". Renew it to keep premium access.",
                    "SUBSCRIPTION_RENEWAL", "/plans", "SUBSCRIPTION_RENEWAL:" + subscription.getId() + ":" + subscription.getEndDate());
        }
    }
}
