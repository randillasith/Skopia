package org.gp14.skopia.user.dto;

import org.gp14.skopia.model.user.*;
import java.util.Arrays;
import java.util.List;

public record StaffCatalogResponse(List<Option> staffTypes, List<Option> adminLevels,
                                   List<Option> supportLevels, List<Option> supportShifts,
                                   List<Option> marketingDepartments) {
    public record Option(String value, String label) {}
    public static StaffCatalogResponse canonical() {
        return new StaffCatalogResponse(
            options(StaffType.values(), v -> title(v.name())),
            options(AdminLevel.values(), AdminLevel::getLabel),
            options(SupportLevel.values(), SupportLevel::getLabel),
            options(SupportShift.values(), SupportShift::getLabel),
            options(MarketingDepartment.values(), MarketingDepartment::getLabel));
    }
    private static <T extends Enum<T>> List<Option> options(T[] values, java.util.function.Function<T,String> label) {
        return Arrays.stream(values).map(v -> new Option(v.name(), label.apply(v))).toList();
    }
    private static String title(String value) {
        String text=value.toLowerCase().replace('_',' ');
        return Character.toUpperCase(text.charAt(0))+text.substring(1);
    }
}
