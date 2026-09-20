package org.gp14.skopia.complaint;

import org.springframework.stereotype.Service;

/**
 * Placeholder for step 5's "reporting-user status notification".
 * Wire this to email/SMS/in-app notifications once your team decides the channel.
 */
@Service
public class NotificationService {

    public void notifyViewerOfStatusChange(Long viewerId, Long complaintId, ComplaintStatus newStatus) {
        // TODO: replace with a real notification channel (email, in-app, etc.)
        System.out.printf("Notify viewer %d: complaint %d status changed to %s%n",
                viewerId, complaintId, newStatus);
    }
}
