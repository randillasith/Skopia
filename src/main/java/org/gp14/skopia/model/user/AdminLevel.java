package org.gp14.skopia.model.user;

public enum AdminLevel {
    LEVEL_1("Administrator"),
    SUPER("Super Administrator");

    private final String label;
    AdminLevel(String label) { this.label = label; }
    public String getLabel() { return label; }
}
