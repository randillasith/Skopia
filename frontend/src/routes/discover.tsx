import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flame, Compass, ListEnd, Trash2, X, Play, GripVertical } from 'lucide-react'
import { Button, EmptyState, Section, useToast, Avatar } from '@/components/primitives'
import { PosterPlate, Lightbox } from '@/components/world'
import { FrontOfHouse } from '@/components/Shell'
import { GENRES, LIVE, fmt, seconds, clock, isVerified, type Video } from '@/lib/data'
import { useCatalogue } from '@/lib/useCatalogue'
import { Resolve } from '@/components/Loading'
import { CHANNELS, channelByName } from '@/lib/session'
import { useLibrary } from '@/lib/library'
import { Tile } from './viewer'

/* ================================================================== live */

/**
 * A live broadcast has no runtime and no resume point, so it gets its own card
 * rather than being squeezed into the video tile: what matters is that it is
 * happening now and how many people are already there.
 */
function LiveCard({ l }: { l: (typeof LIVE)[number] }) {
  const channel = channelByName(l.creator)
  return (
    <article className="group min-w-0">
      <Lightbox interactive>
        <span className="relative block aspect-video">
          <PosterPlate title={l.title} seed={l.seed} category={l.category} compact />
          <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-xs bg-danger-500/90 px-1.5 py-0.5 backdrop-blur">
            {/* The dot is the only looping animation in the system, and it earns
                it: "live" is a claim about right now, and a still badge cannot
                distinguish itself from one that was left on the page. */}
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-white" />
            </span>
            <span className="letterboard text-fg">Live</span>
          </span>
          <span className="absolute bottom-1.5 right-1.5 rounded-xs bg-ink-950/85 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-fg backdrop-blur-[2px]">
            {fmt(l.watching)} watching
          </span>
        </span>
      </Lightbox>
      <div className="mt-2.5 min-w-0">
        <h3 className="font-marquee truncate text-[15px] font-bold tracking-tight text-fg group-hover:text-tone-violet-200">
          {l.title}
        </h3>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-300">
          <Link to={`/channel/${channel?.handle ?? ''}`} className="hover:text-ink-100">
            {l.creator}
          </Link>
          {' · started '}{l.startedAt}
        </p>
      </div>
    </article>
  )
}

/* ================================================================ explore */

export function Explore() {
  const { videos, categories, loading, error, refresh } = useCatalogue()
  const [genre, setGenre] = useState<string>('All')

  const byCategory = useMemo(
    () =>
      categories.map(({ id, name }) => ({
        id,
        category: name,
        items: videos.filter(
          (v) =>
            v.category === name &&
            (v.billing === 'NOW SHOWING' || v.billing === 'HELD OVER') &&
            (genre === 'All' || v.genre === genre),
        ).slice(0, 6),
      })).filter((s) => s.items.length > 0),
    [videos, categories, genre],
  )

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <p className="letterboard text-ink-300">Discover</p>
        <h1 className="font-marquee mt-1 text-[clamp(1.8rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-fg">
          Explore
        </h1>

        {/* Genre cuts across categories, which is the whole point of this page:
            Home ranks by billing, Explore lets you slice sideways. */}
        <div className="mt-5 flex flex-wrap gap-2">
          {['All', ...GENRES].map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              aria-pressed={genre === g}
              className={cnChip(genre === g)}
            >
              {g}
            </button>
          ))}
        </div>

        {LIVE.length > 0 && genre === 'All' && (
          <Section title="Live now" className="mt-9">
            <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {LIVE.map((l) => <LiveCard key={l.id} l={l} />)}
            </div>
          </Section>
        )}

        <Section title="Channels" className="mt-10">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CHANNELS.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/channel/${c.handle}`}
                  className="group flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-850 p-3 transition-colors hover:border-ink-600"
                >
                  <Avatar name={c.name} size={42} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-[14px] font-medium text-fg group-hover:text-tone-violet-200">
                      {c.name}
                      {isVerified(c.name) && <VerifiedMark />}
                    </span>
                    <span className="block truncate font-mono text-[11px] tabular-nums text-ink-300">
                      {fmt(c.subscribers)} following
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        {byCategory.map(({ category, items }) => (
          <Section key={category} title={category} className="mt-10">
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {items.map((v) => <Tile key={v.id} v={v} size="sm" />)}
            </div>
          </Section>
        ))}

        {(loading || error) && (
          <div className="mt-10">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Reading the catalogue">
              {null}
            </Resolve>
          </div>
        )}

        {!loading && !error && byCategory.length === 0 && (
          <div className="mt-10">
            <EmptyState
              icon={<Compass className="size-6" />}
              title="Nothing to explore yet"
              body="No titles are currently billed under this genre."
              action={<Button onClick={() => setGenre('All')}>Show everything</Button>}
            />
          </div>
        )}
      </div>
    </FrontOfHouse>
  )
}

function cnChip(active: boolean) {
  return [
    'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
    active
      ? 'border-violet-400 bg-violet-500/16 text-tone-violet-100'
      : 'border-ink-700 text-ink-300 hover:border-ink-600 hover:text-fg',
  ].join(' ')
}

export function VerifiedMark() {
  return (
    <svg viewBox="0 0 24 24" aria-label="Verified channel" role="img" className="size-3.5 shrink-0 text-tone-cyan-300">
      <path
        fill="currentColor"
        d="M12 1.5 14.6 4l3.5-.4 1 3.4 3 1.8-1.5 3.2 1.5 3.2-3 1.8-1 3.4-3.5-.4L12 22.5 9.4 20l-3.5.4-1-3.4-3-1.8L3.4 12 1.9 8.8l3-1.8 1-3.4 3.5.4L12 1.5Z"
      />
      <path fill="#0b1122" d="m10.9 15.2-3-3 1.2-1.2 1.8 1.8 4.1-4.1 1.2 1.2-5.3 5.3Z" />
    </svg>
  )
}

/* =============================================================== trending */

export function Trending() {
  const { videos, loading, error, refresh } = useCatalogue()
  const [window_, setWindow] = useState<'today' | 'week' | 'month'>('week')

  /**
   * Trending is not "most viewed" — that would be the same list every week and
   * would only ever show the back catalogue. It ranks views against how long a
   * title has been up, so something released on Tuesday can out-rank something
   * that has been accumulating since February.
   */
  const ranked = useMemo(() => {
    const days = window_ === 'today' ? 1 : window_ === 'week' ? 7 : 30
    // The clock, not a fixed date: ranking against a date written into the source
    // stops being a ranking the day after it is written.
    const now = Date.now()
    return videos.filter((v) => v.billing === 'NOW SHOWING' || v.billing === 'HELD OVER')
      .map((v) => {
        const ageDays = Math.max(1, (now - Date.parse(v.published)) / 86_400_000)
        return { v, heat: v.views / Math.pow(ageDays, 0.85) }
      })
      .filter(({ v }) => (now - Date.parse(v.published)) / 86_400_000 <= days * 12)
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 20)
      .map(({ v }) => v)
  }, [videos, window_])

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="letterboard text-ink-300">Discover</p>
            <h1 className="font-marquee mt-1 flex items-center gap-3 text-[clamp(1.8rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-fg">
              <Flame className="size-7 text-tone-gold-400" />
              Trending
            </h1>
          </div>
          <div className="flex gap-2">
            {(['today', 'week', 'month'] as const).map((w) => (
              <button key={w} onClick={() => setWindow(w)} aria-pressed={window_ === w} className={cnChip(window_ === w)}>
                {w === 'today' ? 'Today' : w === 'week' ? 'This week' : 'This month'}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed text-ink-300">
          Ranked by how fast a title is being watched relative to how long it has been up, so the
          back catalogue does not permanently occupy the top of the list.
        </p>

        {loading || error ? (
          <div className="mt-10">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Ranking the programme">
              {null}
            </Resolve>
          </div>
        ) : ranked.length === 0 ? (
          <div className="mt-10">
            <EmptyState icon={<Flame className="size-6" />} title="Nothing is moving yet"
              body="No titles have gathered enough views in this window." />
          </div>
        ) : (
          <ol className="mt-8 divide-y divide-ink-800">
            {ranked.map((v, i) => (
              <li key={v.id} className="group flex items-center gap-4 py-4">
                <span className="font-marquee w-9 shrink-0 text-center text-[22px] font-extrabold tabular-nums text-ink-500 sm:w-12 sm:text-[30px]">
                  {i + 1}
                </span>
                <Link to={`/watch/${v.id}`} className="w-32 shrink-0 overflow-hidden rounded-xs sm:w-44">
                  <span className="block aspect-video">
                    <PosterPlate title={v.title} seed={v.seed} category={v.category} thumbnailUrl={v.thumbnailUrl} compact lettering={false} />
                  </span>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/watch/${v.id}`}>
                    <p className="font-marquee truncate text-[16px] font-bold text-fg group-hover:text-tone-violet-200 sm:text-[18px]">
                      {v.title}
                    </p>
                  </Link>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[13px] text-ink-300">
                    <Link to={`/channel/${channelByName(v.creator)?.handle ?? ''}`} className="truncate hover:text-ink-100">
                      {v.creator}
                    </Link>
                    {isVerified(v.creator) && <VerifiedMark />}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-300">
                    {fmt(v.views)} views · {v.published}
                  </p>
                </div>
                <span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-ink-300 md:block">
                  {v.runtime}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ================================================================== queue */

export function Queue() {
  const nav = useNavigate()
  const toast = useToast()
  const { queue, dequeue, clearQueue } = useLibrary()
  const { byId } = useCatalogue()
  const items = queue.map((id) => byId(id)).filter(Boolean) as Video[]
  const total = clock(items.reduce((s, v) => s + seconds(v.runtime), 0))

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="letterboard text-ink-300">Library</p>
            <h1 className="font-marquee mt-1 text-[clamp(1.8rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-fg">
              Queue
            </h1>
            <p className="mt-2 text-[15px] text-ink-300">
              What plays after this one. It is not saved — clearing the queue loses nothing,
              because nothing here was ever filed anywhere.
            </p>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => { clearQueue(); toast({ title: 'Queue cleared' }) }}>
              Clear queue
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<ListEnd className="size-6" />}
              title="The queue is empty"
              body="Use “Add to queue” on any title and it lines up here, in order."
              action={<Button onClick={() => nav('/browse')}>Find something</Button>}
            />
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={<Play className="size-4 fill-current" />} onClick={() => nav(`/watch/${items[0].id}`)}>
                Play queue
              </Button>
              <span className="font-mono text-[12px] tabular-nums text-ink-300">
                {items.length} titles · {total}
              </span>
            </div>

            <ol className="mt-6 divide-y divide-ink-800">
              {items.map((v, i) => (
                <li key={v.id} className="group flex items-center gap-3 py-3">
                  <GripVertical className="hidden size-4 shrink-0 text-ink-600 sm:block" aria-hidden />
                  <span className="w-5 shrink-0 text-center font-mono text-[12px] tabular-nums text-ink-300">
                    {i + 1}
                  </span>
                  <Link to={`/watch/${v.id}`} className="w-28 shrink-0 overflow-hidden rounded-xs sm:w-36">
                    <span className="block aspect-video">
                      <PosterPlate title={v.title} seed={v.seed} category={v.category} thumbnailUrl={v.thumbnailUrl} compact lettering={false} />
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/watch/${v.id}`}>
                      <p className="font-marquee truncate text-[15px] font-bold text-fg hover:text-tone-violet-200">
                        {v.title}
                      </p>
                    </Link>
                    <p className="truncate text-[12px] text-ink-300">{v.creator}</p>
                  </div>
                  <span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-ink-300 sm:block">
                    {v.runtime}
                  </span>
                  <button
                    aria-label={`Take ${v.title} out of the queue`}
                    onClick={() => { dequeue(v.id); toast({ title: 'Removed from queue' }) }}
                    className="shrink-0 rounded-sm p-2 text-ink-300 opacity-0 transition-opacity hover:bg-ink-800 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}

        {LIVE.length > 0 && (
          <Section title="Live now" className="mt-12">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {LIVE.slice(0, 3).map((l) => <LiveCard key={l.id} l={l} />)}
            </div>
          </Section>
        )}
      </div>
    </FrontOfHouse>
  )
}

export { LiveCard }
