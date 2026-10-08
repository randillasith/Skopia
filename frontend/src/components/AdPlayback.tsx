import { useCallback, useState } from 'react'
import { Player, type PlayerProps } from './player'
import { AdSlot } from './AdSlot'
import { seconds } from '@/lib/data'
import type { SlotPosition } from '@/lib/ads'

/** Coordinates all FR5 surfaces while keeping the feature player mounted. */
export function AdPlayback({ videoId, onTimeChange, ...props }: PlayerProps & { videoId: number | null | undefined }) {
  const [blocking, setBlocking] = useState<SlotPosition | null>('PREROLL')
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [midrollDone, setMidrollDone] = useState(false)
  const [overlayStarted, setOverlayStarted] = useState(false)
  const [overlayDone, setOverlayDone] = useState(false)
  const [lobbyDone, setLobbyDone] = useState(false)
  const [ended, setEnded] = useState(false)
  const duration = seconds(props.video.runtime)
  const onTime = useCallback((at: number) => {
    onTimeChange?.(at)
    if (!playing || blocking || ended || duration <= 0) return
    if (!midrollDone && at >= duration / 2 && at < duration) {
      setMidrollDone(true)
      setBlocking('MIDROLL')
    } else if (!overlayStarted && at >= duration / 4 && at < duration) {
      setOverlayStarted(true)
    }
  }, [onTimeChange, playing, blocking, ended, duration, midrollDone, overlayStarted,
    setMidrollDone, setBlocking, setOverlayStarted])
  const onPlaying = useCallback((value: boolean) => {
    setPlaying(value)
    if (value) setStarted(true)
  }, [setPlaying, setStarted])

  const finishBreak = () => {
    const wasPostroll = blocking === 'POSTROLL'
    setBlocking(null)
    if (wasPostroll) props.onEnded?.()
  }

  return <>
    <div className="relative bg-black" data-ad-playback>
      <div className={blocking ? 'invisible absolute inset-0 pointer-events-none' : ''} aria-hidden={!!blocking} inert={!!blocking}>
        <Player {...props} interrupted={!!blocking} onTimeChange={onTime} onPlayingChange={onPlaying}
          onEnded={() => { setEnded(true); setOverlayDone(true); setBlocking('POSTROLL') }} />
      </div>
      {blocking && <AdSlot key={blocking} videoId={videoId} slot={blocking} onFinished={finishBreak} />}
      {overlayStarted && !overlayDone && !ended &&
        <div className={`absolute bottom-20 right-3 z-10 w-[min(65%,24rem)] ${blocking ? 'hidden' : ''}`}>
          <AdSlot compact videoId={videoId} slot="OVERLAY" onFinished={() => setOverlayDone(true)} />
        </div>}
    </div>
    {!blocking && !started && !lobbyDone && <div className="mt-3" aria-label="Lobby advertising">
      <AdSlot compact videoId={videoId} slot="LOBBY" onFinished={() => setLobbyDone(true)} />
    </div>}
  </>
}
