package org.gp14.skopia.video;

/** Interchangeable rule for a published video's access tier. */
interface VideoPlaybackStrategy {
    boolean canPlay(Long userId);
}
