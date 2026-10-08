package org.gp14.skopia.advertising;

import org.gp14.skopia.model.advertisement.AdPlacement;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/** Default policy: highest priority first, rotating equally ranked advertisers. */
@Component
@ConditionalOnProperty(name = "skopia.ads.selection", havingValue = "rotation", matchIfMissing = true)
public class PriorityRotationStrategy implements AdSelectionStrategy {
    @Override
    public List<AdPlacement> select(List<AdPlacement> eligible, int limit) {
        if (limit <= 0) return List.of();
        Map<Integer, List<AdPlacement>> bands = new TreeMap<>(Comparator.reverseOrder());
        for (AdPlacement placement : eligible) {
            bands.computeIfAbsent(placement.getPriority() == null ? 1 : placement.getPriority(),
                    key -> new ArrayList<>()).add(placement);
        }
        List<AdPlacement> selected = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (List<AdPlacement> band : bands.values()) {
            Collections.shuffle(band, ThreadLocalRandom.current());
            for (AdPlacement placement : band) {
                if (seen.add(placement.getAdvertisement().getId())) selected.add(placement);
                if (selected.size() == limit) return selected;
            }
        }
        return selected;
    }
}
