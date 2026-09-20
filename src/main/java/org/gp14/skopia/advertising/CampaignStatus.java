package org.gp14.skopia.advertising;

/**
 * Where a campaign is in its life.
 *
 * <p>Only three of these are chosen by a person. {@link #ACTIVE} and {@link #EXPIRED}
 * are consequences of the clock: a scheduled campaign becomes active when its start
 * date passes, and any campaign becomes expired when its end date does. The serving
 * engine never trusts a stored status on its own — it re-checks the dates — so a
 * stale row cannot put an ended advertisement back in front of a viewer.
 *
 * <p>Transitions: DRAFT → SCHEDULED → ACTIVE → EXPIRED → ARCHIVED, with PAUSED
 * reachable from SCHEDULED or ACTIVE and returning to whichever the dates imply.
 */
public enum CampaignStatus {
    /** Being written. Never served, and its dates are not yet binding. */
    DRAFT,
    /** Confirmed, but its start date has not arrived. */
    SCHEDULED,
    /** Inside its window, and eligible to serve. */
    ACTIVE,
    /** Held back by a marketing officer. Eligible again only when resumed. */
    PAUSED,
    /** Its end date has passed. Kept, and kept out of delivery. */
    EXPIRED,
    /** Filed away. Out of the working list, still counted in past reporting. */
    ARCHIVED;

    /** True when a campaign in this status may be considered for delivery. */
    public boolean servable() {
        return this == SCHEDULED || this == ACTIVE;
    }

    /** True when the status is a person's decision rather than the clock's. */
    public boolean chosenByHand() {
        return this == DRAFT || this == PAUSED || this == ARCHIVED;
    }
}
