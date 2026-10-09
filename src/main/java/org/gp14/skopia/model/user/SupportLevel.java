package org.gp14.skopia.model.user;

public enum SupportLevel {
    TIER_1("Tier 1"), TIER_2("Tier 2"), TIER_3("Tier 3");
    private final String label;
    SupportLevel(String label) { this.label = label; }
    public String getLabel() { return label; }
}
