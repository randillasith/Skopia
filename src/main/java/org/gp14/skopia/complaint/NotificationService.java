package org.gp14.skopia.complaint;

import org.gp14.skopia.repository.UserRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

/**
 * Complaint-facing notification adapter. It writes durable in-app notifications
 * through the platform notification service so reporters can see moderation
 * results in their notification bell and notifications page.
 */
@Service
public class NotificationService {
    private final org.gp14.skopia.notification.NotificationService platformNotifications;
    private final UserRepository users;

    public NotificationService(
            @Qualifier("platformNotificationService") org.gp14.skopia.notification.NotificationService platformNotifications,
            UserRepository users) {
        this.platformNotifications = platformNotifications;
        this.users = users;
    }

    public void notifyViewerOfStatusChange(Long viewerId, Long complaintId, ComplaintStatus newStatus) {
        users.findById(viewerId).ifPresent(user -> platformNotifications.create(
                user,
                "Complaint " + newStatus.name().toLowerCase().replace('_', ' '),
                "Your complaint " + complaintId + " is now " + newStatus.name().toLowerCase().replace('_', ' ') + ".",
                "COMPLAINT_STATUS",
                "/notifications",
                "COMPLAINT_STATUS:" + complaintId + ":" + newStatus.name()
        ));
    }

    public void notifyViewerOfVideoTakedown(Long viewerId, Long videoId, String videoTitle) {
        users.findById(viewerId).ifPresent(user ->
                platformNotifications.notifyVideoTakenDown(user, videoId, videoTitle));
    }
}
