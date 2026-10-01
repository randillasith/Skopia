package org.gp14.skopia.advertising.dto;

/**
 * Delivery totals for one campaign, fetched alongside every other campaign's.
 *
 * <p>The single-campaign query it replaces was called once per row of the list,
 * which is three queries a campaign before anything is drawn. This carries the id
 * so one query can answer for the whole page.
 */
public record CampaignTotalsRow(Long campaignId, long impressions, Long clicks) {

    public long clickCount() {
        return clicks == null ? 0L : clicks;
    }
}
