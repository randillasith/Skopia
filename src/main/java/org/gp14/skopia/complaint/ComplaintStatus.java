package org.gp14.skopia.complaint;

/**
 * Lifecycle states for a complaint (UC-FR3-02).
 * Open Issue #1 flags that status values are not yet specified —
 * this set covers the Main Scenario + Extensions 3a; confirm with your team.
 */
public enum ComplaintStatus {
    OPEN,          // just created, waiting to be assigned (step 1)
    ASSIGNED,      // officer accepted it (step 2)
    IN_PROGRESS,   // officer investigating, no final resolution yet (extension 3a)
    ESCALATED,     // handed to Platform Administrator for moderation (extension 4a)
    RESOLVED,      // resolution recorded (step 4-5)
    CLOSED         // officer closed it after resolution (step 7)
}
