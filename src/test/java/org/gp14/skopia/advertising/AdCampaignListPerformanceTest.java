package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.CampaignRequest;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManagerFactory;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the campaign list costs, counted rather than assumed.
 *
 * <p>The console opens on this list, so it is the one advertising call every
 * officer makes every session. It used to run three queries per campaign — the
 * delivery totals, the placements and the advertisements, each fetched one
 * campaign at a time — which is fine for the six rows a demo has and is a
 * hundred and fifty round trips for a year's bookings.
 *
 * <p>The assertion is deliberately on the shape rather than on an exact number:
 * what matters is that the cost stops growing with the number of campaigns, not
 * that it is any particular constant.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdCampaignListPerformanceTest {

    @Autowired AdCampaignService campaigns;
    @Autowired AdvertisingFixture fixture;
    @Autowired EntityManagerFactory entityManagerFactory;

    private Long officer;

    @BeforeEach
    void setUp() {
        officer = fixture.officer().getId();
    }

    private Statistics statistics() {
        return entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }

    private void book(String name) {
        campaigns.create(officer, new CampaignRequest(
                name, "An advertiser",
                LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(30),
                BigDecimal.TEN));
    }

    @Test
    @DisplayName("listing campaigns does not cost more queries per campaign")
    void listingDoesNotScaleWithTheNumberOfCampaigns() {
        for (int i = 0; i < 3; i++) {
            book("Campaign " + i);
        }
        Statistics stats = statistics();
        stats.clear();
        campaigns.list(officer, null, null);
        long forThree = stats.getPrepareStatementCount();

        for (int i = 3; i < 12; i++) {
            book("Campaign " + i);
        }
        stats.clear();
        campaigns.list(officer, null, null);
        long forTwelve = stats.getPrepareStatementCount();

        assertThat(forTwelve)
                .as("listing 12 campaigns cost %d queries where 3 cost %d — the per-campaign "
                        + "fetches are still there", forTwelve, forThree)
                .isLessThanOrEqualTo(forThree + 2);
    }
}
