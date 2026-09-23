package org.gp14.skopia.advertising;

/**
 * Where in the viewing experience a placement puts an advertisement.
 *
 * <p>The names are the serving contract, not presentation: the player asks for the
 * slot it is about to fill, so adding a slot here is what makes a new surface
 * addressable. {@code LOBBY} is the only one outside playback.
 */
public enum SlotPosition {
    PREROLL,
    MIDROLL,
    POSTROLL,
    OVERLAY,
    LOBBY
}
