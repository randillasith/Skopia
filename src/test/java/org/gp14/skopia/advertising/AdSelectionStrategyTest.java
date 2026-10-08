package org.gp14.skopia.advertising;

import org.gp14.skopia.model.advertisement.AdPlacement;
import org.gp14.skopia.model.advertisement.Advertisement;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import java.util.List;
import java.util.ArrayList;
import static org.assertj.core.api.Assertions.assertThat;

class AdSelectionStrategyTest {
    @Test void bothPoliciesRespectPriorityDeduplicationAndLimitsWithoutMutatingInput() {
        var high = placement(2, 20, 9);
        var duplicate = placement(3, 20, 1);
        var low = placement(1, 10, 1);
        var input = new ArrayList<>(List.of(low, duplicate, high));
        for (AdSelectionStrategy strategy : List.of(new PriorityRotationStrategy(), new StablePriorityStrategy())) {
            assertThat(strategy.select(input, 1)).containsExactly(high);
            assertThat(strategy.select(input, 5)).containsExactly(high, low);
            assertThat(strategy.select(input, 0)).isEmpty();
            assertThat(strategy.select(List.of(), 3)).isEmpty();
            assertThat(input).containsExactly(low, duplicate, high);
        }
    }

    @Test void stablePolicyBreaksTiesByPlacementIdAndDefaultsNullPriorityToOne() {
        var first = placement(1, 10, null);
        var second = placement(2, 20, 1);
        assertThat(new StablePriorityStrategy().select(List.of(second, first), 2)).containsExactly(first, second);
    }

    @Test void configurationSwapsStrategiesWithoutChangingTheServingContext() {
        var context = new ApplicationContextRunner()
                .withUserConfiguration(PriorityRotationStrategy.class, StablePriorityStrategy.class);
        context.run(c -> assertThat(c.getBean(AdSelectionStrategy.class)).isInstanceOf(PriorityRotationStrategy.class));
        context.withPropertyValues("skopia.ads.selection=stable")
                .run(c -> assertThat(c.getBean(AdSelectionStrategy.class)).isInstanceOf(StablePriorityStrategy.class));
    }

    private AdPlacement placement(long id, long adId, Integer priority) {
        var ad = new Advertisement(); ad.setId(adId);
        var placement = new AdPlacement(); placement.setId(id);
        placement.setAdvertisement(ad); placement.setPriority(priority);
        return placement;
    }
}
