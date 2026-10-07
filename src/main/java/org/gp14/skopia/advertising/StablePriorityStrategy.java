package org.gp14.skopia.advertising;

import org.gp14.skopia.model.advertisement.AdPlacement;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import java.util.*;

/** Optional deterministic policy: priority descending, then placement id ascending. */
@Component
@ConditionalOnProperty(name = "skopia.ads.selection", havingValue = "stable")
public class StablePriorityStrategy implements AdSelectionStrategy {
    @Override
    public List<AdPlacement> select(List<AdPlacement> eligible, int limit) {
        if (limit <= 0) return List.of();
        List<AdPlacement> ordered = new ArrayList<>(eligible);
        ordered.sort(Comparator.comparingInt((AdPlacement p) -> p.getPriority() == null ? 1 : p.getPriority())
                .reversed().thenComparing(AdPlacement::getId));
        List<AdPlacement> selected = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (AdPlacement placement : ordered) {
            if (seen.add(placement.getAdvertisement().getId())) selected.add(placement);
            if (selected.size() == limit) break;
        }
        return selected;
    }
}
