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
  viewerId = null,
  onFinished,
}: {
  /**
   * The backend's numeric video id. `undefined` means still being resolved —
   * wait. `null` means there is no such title, so there is nothing to serve
   * against and the break ends immediately. Collapsing the two would leave the
   * player sitting on a blank screen while the lookup was still in flight.
   */
  videoId: number | null | undefined
  slot?: SlotPosition
  viewerId?: number | null
  /** Called when the break is over — skipped, ended, or never filled. */
  onFinished: () => void
}) {
  const [ad, setAd] = useState<ServedAd | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Held in a ref so the effects below do not re-run when the parent re-renders
  // with a new closure, which would ask for a second advertisement and record a
  // second impression for one break.
  const finish = useRef(onFinished)
  useEffect(() => { finish.current = onFinished }, [onFinished])

  useEffect(() => {
    // Still resolving: hold, and show nothing yet.
    if (videoId === undefined) return
    // Resolved to nothing: there is no title to serve against, so the break is
    // over before it started.
    if (videoId === null) {
      finish.current()
      return
    }
    let live = true

    ads.serving
      .active(videoId, slot, { viewerId, device: deviceKind() })
      .then((served) => {
        if (!live) return
        if (served.length === 0) {
          // Nothing booked here. That is ordinary, not a failure.
          finish.current()
          return
        }
        setAd(served[0])
      })
      .catch(() => {
        // Advertising must never be what stops someone watching. If the serving
        // call fails, the break is simply over.
        if (live) finish.current()
      })

    return () => { live = false }
  }, [videoId, slot, viewerId])

  // The countdown, and the automatic end of a video advertisement.
  useEffect(() => {
    if (!ad) return
    const tick = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(tick)
  }, [ad])

  useEffect(() => {
    if (!ad) return
    const runsFor = ad.adType === 'VIDEO' && ad.adDuration > 0 ? ad.adDuration : 8
    if (elapsed >= runsFor) finish.current()
  }, [ad, elapsed])

  if (!ad) return null

  const runsFor = ad.adType === 'VIDEO' && ad.adDuration > 0 ? ad.adDuration : 8
  const canSkip = elapsed >= SKIP_AFTER
  const remaining = Math.max(0, runsFor - elapsed)

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink-950">
      {ad.adType === 'VIDEO' ? (
        <video
          src={ad.mediaUrl}
          autoPlay
          muted
          playsInline
          onEnded={() => finish.current()}
          className="size-full object-contain"
        />
      ) : (
        <img src={ad.mediaUrl} alt={ad.adTitle} className="size-full object-cover" />
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
          <p className="font-marquee truncate text-[17px] font-bold text-white">{ad.adTitle}</p>
          {ad.advertiser && <p className="text-[12.5px] text-ink-300">{ad.advertiser}</p>}
          {ad.clickUrl && (
            <a
              href={ad.clickUrl}
              target="_blank"
              rel="noreferrer noopener sponsored"
              className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-cyan-300 underline hover:text-cyan-200"
            >
              <Link2 className="size-3.5" /> Find out more
            </a>
          )}
        </div>

        <Button
          size="sm"
          variant={canSkip ? 'primary' : 'quiet'}
          disabled={!canSkip}
          icon={<SkipForward className="size-4" />}
          onClick={() => finish.current()}
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

/**
 * Resolve one of the prototype's titles to the backend's numeric video id.
 *
 * <p>A seam, and a temporary one. The catalogue this UI renders is still the
 * placeholder list in `lib/data.ts`, whose ids look like `v-1041`, while the
 * serving API works in the real `videos.video_id`. Matching on the title is what
 * bridges the two until the browse and watch screens read the catalogue from the
 * API — at which point the numeric id is already in hand and this goes away.
 *
 * <p>Returns `undefined` while looking, and `null` when there is no such title,
 * so the player can tell "still asking" from "not in the catalogue".
 */
export function useBackendVideoId(title: string | undefined): number | null | undefined {
  const [id, setId] = useState<number | null | undefined>(undefined)

  useEffect(() => {
    if (!title) {
      setId(null)
      return
    }
    let live = true
    setId(undefined)

    fetch(`/api/videos?search=${encodeURIComponent(title)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { id: number; title: string }[]) => {
        if (!live) return
        const exact = rows.find((v) => v.title.toLowerCase() === title.toLowerCase())
        setId(exact?.id ?? null)
      })
      .catch(() => { if (live) setId(null) })

    return () => { live = false }
  }, [title])

  return id
}
