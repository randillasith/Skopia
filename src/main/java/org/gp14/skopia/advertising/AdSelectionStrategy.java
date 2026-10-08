package org.gp14.skopia.advertising;

import org.gp14.skopia.model.advertisement.AdPlacement;
import java.util.List;

/** Strategy contract: select distinct advertisements from already eligible placements. */
public interface AdSelectionStrategy {
    List<AdPlacement> select(List<AdPlacement> eligible, int limit);
}
