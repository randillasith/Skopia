/**
 * FR5 — an advertisement, as a viewer sees it.
 *
 * Three things this component is strict about, because each of them is a promise
 * FR5 makes to somebody:
 *
 *   - It is always labelled as advertising, and that label is not a prop.
 *   - The impression is whatever the server recorded. Nothing is counted here.
 *   - A click leaves through the platform's tracking URL, never the advertiser's
 *     own, so a click that was not counted is a click that did not happen.
 *
 * When nothing is booked against a title — the common case — it renders nothing
 * and says so to its parent through `onFinished`, so the player does not sit on a
 * blank screen waiting for an advertisement that was never coming.
 */

import { useEffect, useRef, useState } from 'react'
import { Link2, SkipForward } from 'lucide-react'
import { Button } from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { ads, deviceKind, SLOT_LABEL, type ServedAd, type SlotPosition } from '@/lib/ads'

/** Seconds a viewer must watch before skipping becomes available. */
const SKIP_AFTER = 5

export function AdSlot({
  videoId,
  slot = 'PREROLL',
  onFinished,
  compact = false,
}: {
  /**
   * The backend's numeric video id. `undefined` means still being resolved —
   * wait. `null` means there is no such title, so there is nothing to serve
   * against and the break ends immediately. Collapsing the two would leave the
   * player sitting on a blank screen while the lookup was still in flight.
   */
  videoId: number | null | undefined
  slot?: SlotPosition
  // No viewer prop: who saw this is the server's business, taken from the
  // bearer token. A guest has none and is recorded as one.
  /** Called when the break is over — skipped, ended, or never filled. */
  onFinished: () => void
  compact?: boolean
}) {
  const [ad, setAd] = useState<ServedAd | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [clickError, setClickError] = useState(false)

  // Held in a ref so the effects below do not re-run when the parent re-renders
  // with a new closure, which would ask for a second advertisement and record a
  // second impression for one break.
  const finish = useRef(onFinished)
  const finished = useRef(false)
  const complete = () => {
    if (finished.current) return
    finished.current = true
    finish.current()
  }
  useEffect(() => { finish.current = onFinished }, [onFinished])

  useEffect(() => {
    // Still resolving: hold, and show nothing yet.
    if (videoId === undefined) return
    // Resolved to nothing: there is no title to serve against, so the break is
    // over before it started.
    if (videoId === null) {
      complete()
      return
    }
    let live = true
    const abort = new AbortController()

    ads.serving
      .active(videoId, slot, { device: deviceKind(), signal: abort.signal })
      .then((served) => {
        if (!live) return
        if (served.length === 0) {
          // Nothing booked here. That is ordinary, not a failure.
          complete()
          return
        }
        setAd(served[0])
      })
      .catch(() => {
        // Advertising must never be what stops someone watching. If the serving
        // call fails, the break is simply over.
        if (live) complete()
      })

    return () => { live = false; abort.abort() }
  }, [videoId, slot])

  // The countdown, and the automatic end of a video advertisement.
  useEffect(() => {
    if (!ad) return
    const tick = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(tick)
  }, [ad])

  useEffect(() => {
    if (!ad) return
    const runsFor = ad.adType === 'VIDEO' && ad.adDuration > 0 ? ad.adDuration : 8
    if (elapsed >= runsFor) complete()
  }, [ad, elapsed])

  if (!ad) return null

  const runsFor = ad.adType === 'VIDEO' && ad.adDuration > 0 ? ad.adDuration : 8
  const canSkip = elapsed >= SKIP_AFTER
  const remaining = Math.max(0, runsFor - elapsed)

  return (
    <div aria-label={`${SLOT_LABEL[slot]} advertisement`} className={`theme-media relative aspect-video overflow-hidden bg-ink-950 ${compact ? 'w-full max-w-sm rounded-sm shadow-lg' : ''}`}>
      {ad.adType === 'VIDEO' ? (
        <video
          src={ad.mediaUrl}
          autoPlay
          muted
          playsInline
          onEnded={complete}
          onError={complete}
          className="size-full object-contain"
        />
      ) : (
        <img src={ad.mediaUrl} alt={ad.adTitle} onError={complete} className="size-full object-cover" />
      )}

      {/* The label is not optional and not configurable. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-ink-950/85 to-transparent p-3">
        <Letterboard tone="held">{ad.label}</Letterboard>
        <span className="font-mono text-[11px] text-ink-200">
          {SLOT_LABEL[ad.slotPosition]} · {remaining}s
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-ink-950/90 to-transparent p-4">
        <div className="min-w-0">
          <p className="font-marquee truncate text-[17px] font-bold text-fg">{ad.adTitle}</p>
          {ad.advertiser && <p className="text-[12.5px] text-ink-300">{ad.advertiser}</p>}
          {ad.clickUrl && (
            <a
              href={ad.clickUrl}
              target="_blank"
              rel="noreferrer noopener sponsored"
              onClick={(event) => {
                event.preventDefault()
                const tab = window.open('about:blank', '_blank')
                if (!tab) { setClickError(true); return }
                tab.opener = null
                setClickError(false)
                ads.serving.click(ad.impressionId).then(({ destination }) => {
                  tab.location.replace(destination)
                }).catch(() => { tab.close(); setClickError(true) })
              }}
              className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-tone-cyan-300 underline hover:text-tone-cyan-200"
            >
              <Link2 className="size-3.5" /> Find out more
            </a>
          )}
          {clickError && <p role="alert" className="mt-1 text-sm text-tone-danger-400">The promotional link could not open. Please try again.</p>}
        </div>

        <Button
          size="sm"
          variant={canSkip ? 'primary' : 'quiet'}
          disabled={!canSkip}
          icon={<SkipForward className="size-4" />}
          onClick={complete}
        >
          {canSkip ? 'Skip advertisement' : `Skip in ${SKIP_AFTER - elapsed}s`}
        </Button>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-ink-700">
        <div
          className="h-full bg-violet-500 transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(100, (elapsed / runsFor) * 100)}%` }}
        />
      </div>
    </div>
  )
}
