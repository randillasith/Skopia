package org.gp14.skopia.video;

final class FreeVideoPlaybackStrategy implements VideoPlaybackStrategy {
    @Override
    public boolean canPlay(Long userId) {
        return true;
    }
}
