package org.gp14.skopia.model.user;

public enum MarketingDepartment {
    MARKETING("Marketing"), ADVERTISING("Advertising"), PARTNERSHIPS("Partnerships");
    private final String label;
    MarketingDepartment(String label) { this.label = label; }
    public String getLabel() { return label; }
}
