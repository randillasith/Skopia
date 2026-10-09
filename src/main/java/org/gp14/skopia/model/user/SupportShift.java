package org.gp14.skopia.model.user;

public enum SupportShift {
    DAY("Day"), EVENING("Evening"), NIGHT("Night");
    private final String label;
    SupportShift(String label) { this.label = label; }
    public String getLabel() { return label; }
}
