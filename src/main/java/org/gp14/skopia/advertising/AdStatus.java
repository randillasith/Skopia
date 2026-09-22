package org.gp14.skopia.advertising;

/**
 * Whether an individual advertisement inside a campaign may run.
 *
 * <p>Deliberately smaller than {@link CampaignStatus}: scheduling belongs to the
 * campaign, so an advertisement only says whether it is finished being written
 * ({@link #DRAFT}) and whether it is switched on ({@link #ACTIVE} / {@link #INACTIVE}).
 * An active advertisement inside an expired campaign still does not serve.
 */
public enum AdStatus {
    DRAFT,
    ACTIVE,
    INACTIVE
}
