import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, Subtitles,
  Settings2, Maximize, Minimize, Gauge, MonitorPlay, Check, ChevronRight, ChevronLeft,
  AlertTriangle, Flag, Keyboard,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { PosterPlate } from './world'
import { Button, Toggle, Placeholder } from './primitives'
import { SPEEDS, chaptersFor, clock, seconds, type Video } from '@/lib/data'

/**
 * The transport.
 *
 * There is no stream behind it, so the clock is driven by a timer rather than a
 * media element. That is deliberate: a scrubber that moves, a chapter that
 * becomes current and a time that counts up make the controls testable and let
 * somebody judge the layout at every state. Everything here maps onto a real
 * `<video>` — `time` becomes `currentTime`, `speed` becomes `playbackRate` — so
 * wiring a stream in later is a substitution, not a rewrite.
 *
 * Fullscreen and captions are real. Picture-in-picture is not offered, because
 * it needs an actual media element and a button that cannot do its job is worse
 * than no button.
 */

const EASE = [0.16, 1, 0.3, 1] as const

export type PlayerProps = {
  video: Video
  theater: boolean
  onTheater: (v: boolean) => void
  autoplay: boolean
  onAutoplay: (v: boolean) => void
  onEnded?: () => void
  onReport: () => void
  /** Lets the page offer "share from here". */
  onTimeChange?: (t: number) => void
  /** Pause for a blocking advertisement without losing the feature's position. */
  interrupted?: boolean
  onPlayingChange?: (playing: boolean) => void
}

function IconBtn({
  children,
  label,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        'rounded-sm p-1.5 transition-colors hover:bg-white/12 disabled:opacity-40',
        active ? 'text-tone-cyan-300' : 'text-ink-100 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

export function Player({
  video,
  theater,
  onTheater,
  autoplay,
  onAutoplay,
  onEnded,
  onReport,
  onTimeChange,
  interrupted = false,
  onPlayingChange,
}: PlayerProps) {
  const total = seconds(video.runtime)
  const chapters = chaptersFor(video.id)

  const shell = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)

  const [time, setTime] = useState(Math.round((video.progress ?? 0) * total))
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [captions, setCaptions] = useState(video.captions.length > 0)
  const [track, setTrack] = useState(video.captions[0] ?? '')
  const [menu, setMenu] = useState<null | 'settings' | 'speed' | 'quality' | 'captions' | 'keys'>(null)
  const [full, setFull] = useState(false)
  const [failed, setFailed] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)

  /**
   * The real media, when there is any.
   *
   * Most of the catalogue is records without files, and the controls below are
   * written against a clock rather than against an element. So the element is
   * driven from the same state the clock is: when a file exists it is the source
   * of truth for time, and when there is none the clock simulates it. Both paths
   * end up in `time`, so the transport, the chapters and the progress written
   * back to the server do not have to know which one is running.
   */
  const media = useRef<HTMLVideoElement>(null)
  const hasMedia = !!video.mediaUrl
  const resumeAfterBreak = useRef(false)
  const simulatedEndNotified = useRef(false)

  useEffect(() => { onPlayingChange?.(playing) }, [playing, onPlayingChange])

  useEffect(() => {
    if (interrupted) {
      resumeAfterBreak.current = media.current ? !media.current.paused : playing
      media.current?.pause()
    } else if (resumeAfterBreak.current) {
      resumeAfterBreak.current = false
      media.current?.play().catch(() => setPlaying(false))
    }
    // Preserve whether playback was running at the start of this interruption.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interrupted])

  useEffect(() => {
    onTimeChange?.(time)
  }, [time, onTimeChange])

  /**
   * Start or stop, whichever of the two is running.
   *
   * With a file, the element is asked and its own play/pause events set the
   * state — asking the element and separately setting the state races, because
   * a blocked or failed play leaves the two disagreeing. Without a file the
   * state is all there is.
   *
   * A browser that refuses to start an unmuted video without a gesture it
   * recognises is not a failure: it is muted and tried once more, which is what
   * the viewer wanted either way. Only a second refusal is a real one.
   */
  const toggle = useCallback(() => {
    const el = media.current
    if (!el) return setPlaying((p) => !p)
    if (el.paused) {
      el.play().catch(() => {
        el.muted = true
        setMuted(true)
        el.play().catch(() => setFailed(true))
      })
    } else {
      el.pause()
    }
  }, [])

  useEffect(() => {
    const el = media.current
    if (!el) return
    el.playbackRate = speed
    el.volume = muted ? 0 : volume
    el.muted = muted
  }, [speed, volume, muted])

  // The clock. Runs at the chosen rate so 2× genuinely reaches the end sooner.
  // Skipped entirely when a file is playing — there the file keeps the time.
  useEffect(() => {
    if (hasMedia) return
    if (!playing || failed || interrupted) return
    const id = window.setInterval(() => {
      setTime((t) => {
        if (t + speed >= total) {
          window.clearInterval(id)
          setPlaying(false)
          return total
        }
        return t + speed
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [playing, speed, total, failed, onEnded, interrupted, hasMedia])

  useEffect(() => {
    if (hasMedia) return
    if (time < total) simulatedEndNotified.current = false
    else if (total > 0 && !simulatedEndNotified.current) {
      simulatedEndNotified.current = true
      onEnded?.()
    }
  }, [time, total, hasMedia, onEnded])

  // A seek moves the element when there is one, and the element's timeupdate
  // brings the state back. Setting both keeps the bar responsive while the
  // element is still seeking.
  const seek = useCallback(
    (to: number) => {
      const at = Math.max(0, Math.min(total, Math.round(to)))
      if (media.current) media.current.currentTime = at
      setTime(at)
    },
    [total],
  )

  const toggleFull = useCallback(() => {
    // Include the advertising surface so a mid-roll remains visible in fullscreen.
    const el = shell.current?.closest<HTMLElement>('[data-ad-playback]') ?? shell.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }, [])

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  /**
   * Keyboard control, the way every serious player has it. Ignored while the
   * caret is in a field — otherwise typing "c" in the comment box would toggle
   * captions, which is the classic way this feature goes wrong.
   */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (interrupted) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (el && /^(BUTTON|A)$/.test(el.tagName) && e.key === ' ') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const k = e.key
      const hit = () => e.preventDefault()

      if (k === ' ' || k === 'k') { hit(); toggle() }
      else if (k === 'ArrowRight') { hit(); seek(time + 5) }
      else if (k === 'ArrowLeft') { hit(); seek(time - 5) }
      else if (k === 'l') { hit(); seek(time + 10) }
      else if (k === 'j') { hit(); seek(time - 10) }
      else if (k === 'f') { hit(); toggleFull() }
      else if (k === 't') { hit(); onTheater(!theater) }
      else if (k === 'm') { hit(); setMuted((m) => !m) }
      else if (k === 'c') { hit(); setCaptions((c) => !c) }
      else if (k === 'ArrowUp') { hit(); setVolume((v) => Math.min(1, +(v + 0.1).toFixed(2))) }
      else if (k === 'ArrowDown') { hit(); setVolume((v) => Math.max(0, +(v - 0.1).toFixed(2))) }
      else if (k === '>' || (k === '.' && e.shiftKey)) {
        hit()
        setSpeed((s) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(s as never) + 1)] ?? s)
      } else if (k === '<' || (k === ',' && e.shiftKey)) {
        hit()
        setSpeed((s) => SPEEDS[Math.max(0, SPEEDS.indexOf(s as never) - 1)] ?? s)
      } else if (/^[0-9]$/.test(k)) { hit(); seek((total * Number(k)) / 10) }
      else if (k === '?') { hit(); setMenu((m) => (m === 'keys' ? null : 'keys')) }
      else if (k === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [time, seek, toggle, toggleFull, theater, onTheater, total, interrupted])

  const pct = (t: number) => (total === 0 ? 0 : (t / total) * 100)
  const current = chapters.filter((c) => c.at <= time).pop()

  const fromEvent = (e: React.MouseEvent) => {
    const r = bar.current?.getBoundingClientRect()
    if (!r) return 0
    return ((e.clientX - r.left) / r.width) * total
  }

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div
      ref={shell}
      className={cn('lightbox relative w-full', full ? 'aspect-auto h-screen' : 'aspect-video')}
    >
      {hasMedia ? (
        <video
          ref={media}
          src={video.mediaUrl ?? undefined}
          poster={video.thumbnailUrl ?? undefined}
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full bg-black object-contain"
          onLoadedMetadata={(e) => {
            // Picking the title back up where it was left. Done here rather than
            // on mount because currentTime is ignored before metadata arrives.
            const at = Math.round((video.progress ?? 0) * seconds(video.runtime))
            if (at > 0 && at < e.currentTarget.duration - 5) e.currentTarget.currentTime = at
          }}
          onTimeUpdate={(e) => setTime(Math.floor(e.currentTarget.currentTime))}
          onEnded={() => {
            setPlaying(false)
            onEnded?.()
          }}
          onError={() => setFailed(true)}
          // Deliberately no click handler: the transport and the centre button
          // already sit over this element, and a second toggle underneath them
          // means one click starts playback and stops it again.
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      ) : (
        <>
          {/* No file behind this record, so the poster stands in for one and the
              transport runs off the clock. */}
          <PosterPlate
            title={video.title}
            creator={video.creator}
            runtime={video.runtime}
            seed={video.seed}
            category={video.category}
            thumbnailUrl={video.thumbnailUrl}
          />
          <div className="absolute inset-0 bg-ink-950/45" />
        </>
      )}

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertTriangle className="size-8 text-tone-danger-400" />
          <p className="font-marquee text-[20px] font-bold text-fg">Playback could not start</p>
          <p className="max-w-sm text-[14px] leading-relaxed text-ink-300">
            The stream did not respond. Your connection may have dropped, or this title may be
            temporarily unavailable.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => setFailed(false)}>Try again</Button>
            <Button onClick={onReport} icon={<Flag className="size-4" />}>Report this</Button>
          </div>
        </div>
      ) : (
        <button
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.span
            initial={false}
            animate={{ scale: playing ? 0.88 : 1, opacity: playing ? 0 : 1 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex size-16 items-center justify-center rounded-full bg-violet-500/90 text-white shadow-e3 backdrop-blur"
          >
            <Play className="size-7 fill-current" />
          </motion.span>
        </button>
      )}

      {captions && playing && !failed && (
        <p className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto max-w-lg rounded-xs bg-ink-950/85 px-3 py-1.5 text-center text-[14px] text-fg">
          {current ? `${current.title} —` : ''} placeholder caption line, {track || 'English'} track.
        </p>
      )}

      {/* ---------------------------------------------------------- menus -- */}
      <AnimatePresence>
        {menu && !failed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute bottom-20 right-3 z-20 w-64 overflow-hidden rounded-sm border border-ink-600 bg-ink-950/96 shadow-e4 backdrop-blur"
          >
            {menu === 'settings' && (
              <ul className="py-1">
                <li>
                  <button onClick={() => setMenu('speed')} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] text-ink-100 hover:bg-white/8">
                    <Gauge className="size-4 text-ink-300" />
                    <span className="flex-1">Playback speed</span>
                    <span className="text-ink-300">{speed === 1 ? 'Normal' : `${speed}×`}</span>
                    <ChevronRight className="size-3.5 text-ink-300" />
                  </button>
                </li>
                <li>
                  <button onClick={() => setMenu('quality')} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] text-ink-100 hover:bg-white/8">
                    <MonitorPlay className="size-4 text-ink-300" />
                    <span className="flex-1">Quality</span>
                    <ChevronRight className="size-3.5 text-ink-300" />
                  </button>
                </li>
                <li>
                  <button onClick={() => setMenu('captions')} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] text-ink-100 hover:bg-white/8">
                    <Subtitles className="size-4 text-ink-300" />
                    <span className="flex-1">Captions</span>
                    <span className="text-ink-300">{captions ? track || 'On' : 'Off'}</span>
                    <ChevronRight className="size-3.5 text-ink-300" />
                  </button>
                </li>
                <li className="border-t border-ink-700 px-3.5 py-2.5">
                  <Toggle
                    checked={autoplay}
                    onChange={onAutoplay}
                    label="Autoplay next"
                    description="Plays the next related title when this one ends."
                  />
                </li>
                <li className="border-t border-ink-700">
                  <button onClick={() => setMenu('keys')} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] text-ink-100 hover:bg-white/8">
                    <Keyboard className="size-4 text-ink-300" />
                    <span className="flex-1">Keyboard shortcuts</span>
                  </button>
                </li>
              </ul>
            )}

            {menu === 'speed' && (
              <ul className="py-1">
                <li>
                  <button onClick={() => setMenu('settings')} className="flex w-full items-center gap-2 border-b border-ink-700 px-3 py-2 text-left text-[13px] text-ink-200 hover:bg-white/8">
                    <ChevronLeft className="size-3.5" /> Playback speed
                  </button>
                </li>
                {SPEEDS.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => { setSpeed(s); setMenu('settings') }}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] text-ink-100 hover:bg-white/8"
                    >
                      <span className="w-4">{s === speed && <Check className="size-3.5 text-tone-cyan-300" />}</span>
                      {s === 1 ? 'Normal' : `${s}×`}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {menu === 'quality' && (
              <div className="py-1">
                <button onClick={() => setMenu('settings')} className="flex w-full items-center gap-2 border-b border-ink-700 px-3 py-2 text-left text-[13px] text-ink-200 hover:bg-white/8">
                  <ChevronLeft className="size-3.5" /> Quality
                </button>
                {/* The ladder of resolutions is an open decision in the project
                    documentation. Inventing one here would put a number on a
                    screen that nobody has agreed to serve. */}
                <div className="px-3.5 py-3">
                  <Placeholder>Levels not yet decided</Placeholder>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-300">
                    Quality follows your connection until the available levels are settled.
                  </p>
                </div>
              </div>
            )}

            {menu === 'captions' && (
              <ul className="py-1">
                <li>
                  <button onClick={() => setMenu('settings')} className="flex w-full items-center gap-2 border-b border-ink-700 px-3 py-2 text-left text-[13px] text-ink-200 hover:bg-white/8">
                    <ChevronLeft className="size-3.5" /> Captions
                  </button>
                </li>
                <li>
                  <button onClick={() => { setCaptions(false); setMenu('settings') }} className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] text-ink-100 hover:bg-white/8">
                    <span className="w-4">{!captions && <Check className="size-3.5 text-tone-cyan-300" />}</span>
                    Off
                  </button>
                </li>
                {video.captions.length === 0 ? (
                  <li className="px-3.5 py-2.5 text-[12px] text-ink-300">
                    This title has no caption track.
                  </li>
                ) : (
                  video.captions.map((c) => (
                    <li key={c}>
                      <button
                        onClick={() => { setTrack(c); setCaptions(true); setMenu('settings') }}
                        className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] text-ink-100 hover:bg-white/8"
                      >
                        <span className="w-4">{captions && track === c && <Check className="size-3.5 text-tone-cyan-300" />}</span>
                        {c}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {menu === 'keys' && (
              <div className="py-1">
                <button onClick={() => setMenu('settings')} className="flex w-full items-center gap-2 border-b border-ink-700 px-3 py-2 text-left text-[13px] text-ink-200 hover:bg-white/8">
                  <ChevronLeft className="size-3.5" /> Keyboard shortcuts
                </button>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-3.5 py-3 text-[12px]">
                  {[
                    ['Space  K', 'Play or pause'],
                    ['J  L', 'Back / forward 10s'],
                    ['← →', 'Back / forward 5s'],
                    ['0–9', 'Jump to 0–90%'],
                    ['↑ ↓', 'Volume'],
                    ['M', 'Mute'],
                    ['C', 'Captions'],
                    ['F', 'Full screen'],
                    ['T', 'Theatre'],
                    ['< >', 'Slower / faster'],
                  ].map(([k, d]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono text-ink-100">{k}</dt>
                      <dd className="text-ink-300">{d}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {menu && <div className="absolute inset-0 z-10" onClick={() => setMenu(null)} />}

      {/* ------------------------------------------------------ transport -- */}
      {!failed && (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink-950/95 to-transparent px-3 pb-2.5 pt-10">
          {/* scrubber, segmented by chapter when the creator wrote them */}
          <div
            ref={bar}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={time}
            aria-valuetext={clock(time)}
            tabIndex={0}
            onClick={(e) => seek(fromEvent(e))}
            onMouseMove={(e) => setScrub(fromEvent(e))}
            onMouseLeave={() => setScrub(null)}
            className="group relative h-4 cursor-pointer"
          >
            {scrub !== null && (
              <span
                className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-xs bg-ink-950/95 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-fg"
                style={{ left: `${pct(scrub)}%` }}
              >
                {clock(scrub)}
              </span>
            )}
            <span className="absolute inset-x-0 top-1/2 flex h-1 -translate-y-1/2 gap-0.5 overflow-hidden rounded-full transition-[height] group-hover:h-1.5">
              {(chapters.length ? chapters : [{ at: 0, title: '' }]).map((c, i, arr) => {
                const end = arr[i + 1]?.at ?? total
                const width = ((end - c.at) / total) * 100
                const filled = Math.max(0, Math.min(1, (time - c.at) / (end - c.at)))
                return (
                  <span key={c.at} style={{ width: `${width}%` }} className="relative h-full bg-white/25">
                    <span className="absolute inset-y-0 left-0 bg-violet-500" style={{ width: `${filled * 100}%` }} />
                  </span>
                )
              })}
            </span>
            <span
              className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100"
              style={{ left: `${pct(time)}%` }}
            />
          </div>

          <div className="mt-1 flex items-center gap-0.5 text-ink-100">
            <IconBtn label="Back 10 seconds" onClick={() => seek(time - 10)}><SkipBack className="size-4" /></IconBtn>
            <IconBtn label={playing ? 'Pause' : 'Play'} onClick={toggle}>
              {playing ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
            </IconBtn>
            <IconBtn label="Forward 10 seconds" onClick={() => seek(time + 10)}><SkipForward className="size-4" /></IconBtn>

            {/* volume, with a slider that appears on approach */}
            <span className="group/vol flex items-center">
              <IconBtn label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                <VolIcon className="size-4" />
              </IconBtn>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false) }}
                aria-label="Volume"
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-200 focus-visible:w-16 focus-visible:opacity-100 group-hover/vol:w-16 group-hover/vol:opacity-100 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </span>

            <span className="ml-2 font-mono text-[12px] tabular-nums text-ink-200">
              {clock(time)} / {video.runtime}
            </span>
            {current && (
              <span className="ml-2 hidden truncate text-[12px] text-ink-300 sm:block">
                {current.title}
              </span>
            )}

            <span className="ml-auto flex items-center gap-0.5">
              {speed !== 1 && (
                <span className="mr-1 font-mono text-[11px] text-tone-cyan-300">{speed}×</span>
              )}
              <IconBtn
                label={captions ? 'Turn captions off' : 'Turn captions on'}
                onClick={() => setCaptions((c) => !c)}
                active={captions}
                disabled={video.captions.length === 0}
              >
                <Subtitles className="size-4" />
              </IconBtn>
              <IconBtn label="Settings" onClick={() => setMenu((m) => (m ? null : 'settings'))} active={!!menu}>
                <Settings2 className="size-4" />
              </IconBtn>
              <IconBtn label={theater ? 'Exit theatre mode' : 'Theatre mode'} onClick={() => onTheater(!theater)} active={theater}>
                <MonitorPlay className="size-4" />
              </IconBtn>
              <IconBtn label={full ? 'Exit full screen' : 'Full screen'} onClick={toggleFull}>
                {full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </IconBtn>
            </span>
          </div>
        </div>
      )}

    </div>
  )
}

/** Chapter list beneath the player, when the creator wrote one. */
export function ChapterList({ video }: { video: Video }) {
  const chapters = chaptersFor(video.id)
  if (chapters.length === 0) return null
  return (
    <div className="mt-6 rounded-lg border border-ink-700 bg-ink-850 p-4">
      <p className="letterboard text-ink-300">Chapters</p>
      <ol className="mt-3 divide-y divide-ink-800">
        {chapters.map((c) => (
          <li key={c.at}>
            <div className="flex items-baseline gap-3 py-2">
              <span className="font-mono text-[12px] tabular-nums text-tone-cyan-300">{clock(c.at)}</span>
              <span className="text-[14px] text-ink-100">{c.title}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
