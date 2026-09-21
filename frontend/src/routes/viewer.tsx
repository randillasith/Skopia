import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Play, Bookmark, Share2, Flag, ThumbsUp, ThumbsDown, Trash2, SearchX, Clock,
  Bell, LifeBuoy, ChevronRight, X, ListEnd, Download, Hash, Pin,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Textarea, Toggle, EmptyState,
  Modal, Section, Avatar, Meter, useToast, Tabs,
} from '@/components/primitives'
import { PosterPlate, Lightbox, BillingBoard, Letterboard } from '@/components/world'
import { Player, ChapterList } from '@/components/player'
import { FrontOfHouse, useSession } from '@/components/Shell'
import { AdSlot, useBackendVideoId } from '@/components/AdSlot'
import {
  GENRES, NOTIFICATIONS, fmt, clock, seconds, isVerified, tagsFor, type Video,
} from '@/lib/data'
import { useCatalogue, useVideo, useVideoSearch, useComments } from '@/lib/useCatalogue'
import { catalogue, videoIdOf } from '@/lib/catalogue'
import { actorId as actorIdOf } from '@/lib/session'
import { ApiError } from '@/lib/api'
import { Resolve } from '@/components/Loading'
import { CHANNELS, channelByName } from '@/lib/session'
import { useLibrary } from '@/lib/library'
import { SearchBox } from '@/components/search'
import { VerifiedMark } from './discover'
import { SubscribeButton } from './channel'
import { SaveToPlaylist } from './playlists'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------- poster tile */

export function Tile({ v, size = 'md' }: { v: Video; size?: 'lg' | 'md' | 'sm' }) {
  const { isSaved, toggleWatchLater, isQueued, toggleQueue } = useLibrary()
  const { viewer } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const [saveOpen, setSaveOpen] = useState(false)
  const saved = isSaved(v.id)

  return (
    <article className="group min-w-0">
      <Lightbox interactive>
        <Link to={`/watch/${v.id}`} className="block aspect-video" aria-label={`Play ${v.title}`}>
          <PosterPlate title={v.title} seed={v.seed} category={v.category} compact />
          {typeof v.progress === 'number' && (
            <span className="absolute inset-x-0 bottom-0 block h-0.5 bg-ink-700">
              <span className="block h-full bg-cyan-400" style={{ width: `${v.progress * 100}%` }} />
            </span>
          )}
          {/* Access is stated on every tile, both ways round. Marking only the
              gated ones leaves the rest ambiguous — a viewer cannot tell an
              open title from one whose badge failed to render. */}
          <span
            className={cn(
              'letterboard absolute right-2 top-2 rounded-full border px-2 py-0.5 backdrop-blur',
              v.premium
                ? 'border-gold-500/45 bg-gold-500/12 text-gold-400'
                : 'border-success-500/35 bg-success-500/10 text-success-400',
            )}
          >
            {v.premium ? 'Pass' : 'Free'}
          </span>
          {/* Duration on the thumbnail. It is the first thing anyone checks
              before committing to something, and making them open the page to
              find it is a small tax paid on every browse. */}
          <span className="absolute bottom-1.5 right-1.5 rounded-xs bg-ink-950/85 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white backdrop-blur-[2px]">
            {v.runtime}
          </span>
        </Link>

        {/* Quick actions, on a fine pointer only: on touch there is no hover to
            reveal them, and a permanently visible pair of buttons would compete
            with the artwork on every tile. */}
        <span className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.preventDefault()
              if (!viewer) return nav('/login')
              toggleWatchLater(v.id)
              toast({ title: saved ? 'Removed from Watch later' : 'Saved to Watch later' })
            }}
            aria-label={saved ? `Remove ${v.title} from Watch later` : `Save ${v.title} to Watch later`}
            title={saved ? 'Remove from Watch later' : 'Watch later'}
            className="pointer-events-auto rounded-sm bg-ink-950/85 p-1.5 text-ink-100 backdrop-blur transition-colors hover:text-white"
          >
            <Clock className={cn('size-3.5', saved && 'text-cyan-300')} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              if (!viewer) return nav('/login')
              const added = toggleQueue(v.id)
              toast({ title: added ? `Queued — ${v.title}` : 'Removed from queue' })
            }}
            aria-label={isQueued(v.id) ? `Take ${v.title} out of the queue` : `Add ${v.title} to the queue`}
            title={isQueued(v.id) ? 'In the queue' : 'Add to queue'}
            className="pointer-events-auto rounded-sm bg-ink-950/85 p-1.5 text-ink-100 backdrop-blur transition-colors hover:text-white"
          >
            <ListEnd className={cn('size-3.5', isQueued(v.id) && 'text-cyan-300')} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              if (!viewer) return nav('/login')
              setSaveOpen(true)
            }}
            aria-label={`Save ${v.title} to a playlist`}
            title="Save to playlist"
            className="pointer-events-auto rounded-sm bg-ink-950/85 p-1.5 text-ink-100 backdrop-blur transition-colors hover:text-white"
          >
            <Bookmark className="size-3.5" />
          </button>
        </span>
      </Lightbox>

      <div className="mt-2.5 min-w-0">
        <Link to={`/watch/${v.id}`}>
          <h3
            className={cn(
              'font-marquee truncate font-bold tracking-tight text-white transition-colors group-hover:text-violet-200',
              size === 'lg' && 'text-[22px]',
              size === 'md' && 'text-[16px]',
              size === 'sm' && 'text-[14px]',
            )}
          >
            {v.title}
          </h3>
        </Link>
        {/* The creator is a link, so a shelf is a way into a channel rather than
            a dead end that only leads to single videos. */}
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[13px] text-ink-300">
          <Link
            to={`/channel/${channelByName(v.creator)?.handle ?? ''}`}
            className="truncate transition-colors hover:text-ink-100"
          >
            {v.creator}
          </Link>
          {isVerified(v.creator) && <VerifiedMark />}
          <span aria-hidden>·</span>
          <span className="shrink-0 font-mono tabular-nums">{fmt(v.views)}</span>
        </p>
      </div>

      <SaveToPlaylist videoId={v.id} open={saveOpen} onClose={() => setSaveOpen(false)} />
    </article>
  )
}

/* ================================================================== browse */

export function Browse() {
  const nav = useNavigate()
  const toast = useToast()
  const { isSaved, toggleWatchLater } = useLibrary()
  const { videos, categories, loading, error, refresh } = useCatalogue()
  const [cat, setCat] = useState<string>('All')
  const [sort, setSort] = useState('popular')

  const list = useMemo(() => {
    let l = videos.filter((v) => v.billing !== 'PULLED' && v.billing !== 'IN REVIEW')
    if (cat !== 'All') l = l.filter((v) => v.category === cat)
    if (sort === 'popular') l = [...l].sort((a, b) => b.views - a.views)
    if (sort === 'newest') l = [...l].sort((a, b) => b.published.localeCompare(a.published))
    if (sort === 'title') l = [...l].sort((a, b) => a.title.localeCompare(b.title))
    return l
  }, [videos, cat, sort])

  const [lead, ...rest] = list
  const featured = rest.slice(0, 3)
  const tail = rest.slice(3)

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="letterboard text-ink-300">Tonight’s programme</p>
            <h1 className="font-marquee mt-1 text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold tracking-[-0.03em] text-white">
              The Lobby
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort the programme"
              className="w-44"
            >
              <option value="popular">Most watched</option>
              <option value="newest">Newest first</option>
              <option value="title">A – Z</option>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {['All', ...categories.map((c) => c.name)].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={cn(
                'rounded-sm border px-3 py-1.5 text-[13px] font-medium transition-colors',
                cat === c
                  ? 'border-violet-400 bg-violet-500/16 text-violet-100'
                  : 'border-ink-700 bg-transparent text-ink-300 hover:border-ink-600 hover:text-white',
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {loading || error ? (
          <div className="mt-10">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Reading the programme">
              {null}
            </Resolve>
          </div>
        ) : list.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<SearchX className="size-7" />}
              title={cat === 'All' ? 'Nothing is booked yet' : 'Nothing in that category yet'}
              body={
                cat === 'All'
                  ? 'The catalogue is empty. Once a creator publishes something it appears here.'
                  : 'No titles are currently billed under this category. Try another, or see the whole programme.'
              }
              action={cat !== 'All' && <Button onClick={() => setCat('All')}>Show everything</Button>}
            />
          </div>
        ) : (
          <>
            {/* the lead — full width, display scale */}
            <div className="mt-8 grid gap-7 lg:grid-cols-[1.35fr_1fr] lg:items-center">
              <Lightbox interactive>
                <Link to={`/watch/${lead.id}`} className="block aspect-[16/9]">
                  <PosterPlate
                    title={lead.title}
                    creator={lead.creator}
                    runtime={lead.runtime}
                    seed={lead.seed} category={lead.category}
                  />
                </Link>
              </Lightbox>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <BillingBoard billing={lead.billing} />
                  <Letterboard>{lead.genre}</Letterboard>
                </div>
                <Link to={`/watch/${lead.id}`}>
                  <h2 className="font-marquee mt-3 text-[clamp(1.9rem,4.2vw,3rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-white hover:text-violet-200">
                    {lead.title}
                  </h2>
                </Link>
                <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-300">
                  {lead.synopsis}
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Button variant="primary" icon={<Play className="size-4 fill-current" />}
                    onClick={() => nav(`/watch/${lead.id}`)}>
                    Play
                  </Button>
                  <Button
                    icon={<Bookmark className={cn('size-4', isSaved(lead.id) && 'fill-current')} />}
                    onClick={() => {
                      const added = toggleWatchLater(lead.id)
                      toast({ title: added ? 'Saved to Watch later' : 'Removed from Watch later' })
                    }}
                  >
                    {isSaved(lead.id) ? 'Saved' : 'Watch later'}
                  </Button>
                </div>
              </div>
            </div>

            {/* second billing — ranked by span and size, not a uniform shelf */}
            <div className="mt-12 grid gap-5 border-t border-ink-800 pt-8 lg:grid-cols-3">
              {featured[0] && (
                <div className="lg:col-span-2">
                  <Tile v={featured[0]} size="lg" />
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                {featured.slice(1).map((v) => (
                  <Tile key={v.id} v={v} size="sm" />
                ))}
              </div>
            </div>

            {/* the tail — dense list, not more cards */}
            {tail.length > 0 && (
              <div className="mt-12 border-t border-ink-800 pt-8">
                <p className="letterboard mb-4 text-ink-300">Also playing</p>
                <ul className="divide-y divide-ink-800">
                  {tail.map((v) => (
                    <li key={v.id}>
                      <Link
                        to={`/watch/${v.id}`}
                        className="group flex items-center gap-4 py-3.5 transition-colors hover:bg-ink-850/50"
                      >
                        <span className="w-24 shrink-0 overflow-hidden rounded-xs">
                          <span className="block aspect-video">
                            <PosterPlate title={v.title} seed={v.seed} category={v.category} compact lettering={false} />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-marquee block truncate text-[16px] font-bold text-white group-hover:text-violet-200">
                            {v.title}
                          </span>
                          <span className="block truncate text-[13px] text-ink-300">
                            {v.creator} · {v.category} · {v.genre}
                          </span>
                        </span>
                        <span className="hidden font-mono text-[12px] tabular-nums text-ink-300 sm:block">
                          {fmt(v.views)} views
                        </span>
                        <span className="hidden font-mono text-[12px] tabular-nums text-ink-300 md:block">
                          {v.runtime}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ================================================================== search */

type SearchSort = 'relevance' | 'newest' | 'views' | 'longest'
type Duration = 'any' | 'short' | 'medium' | 'long'
type Age = 'any' | 'month' | 'quarter' | 'year'

const DURATION: Record<Duration, { label: string; test: (v: Video) => boolean }> = {
  any: { label: 'Any length', test: () => true },
  short: { label: 'Under 10 minutes', test: (v) => seconds(v.runtime) < 600 },
  medium: { label: '10 to 40 minutes', test: (v) => seconds(v.runtime) >= 600 && seconds(v.runtime) <= 2400 },
  long: { label: 'Over 40 minutes', test: (v) => seconds(v.runtime) > 2400 },
}

const AGE: Record<Age, { label: string; days: number }> = {
  any: { label: 'Any time', days: Infinity },
  month: { label: 'This month', days: 31 },
  quarter: { label: 'Last 3 months', days: 92 },
  year: { label: 'This year', days: 365 },
}

const SEARCH_SORT: Record<SearchSort, string> = {
  relevance: 'Relevance',
  newest: 'Newest first',
  views: 'Most watched',
  longest: 'Longest first',
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const { recordSearch } = useLibrary()
  const { categories } = useCatalogue()
  const [cat, setCat] = useState('All')
  const [genre, setGenre] = useState('All')
  const [sort, setSort] = useState<SearchSort>('relevance')
  const [dur, setDur] = useState<Duration>('any')
  const [age, setAge] = useState<Age>('any')
  // Captured once. Reading the clock inside the memo would make the same query
  // return slightly different sets as the component re-rendered.
  const [now] = useState(() => Date.now())

  // The query goes to the server rather than being matched against whatever the
  // shelf happens to have loaded, so a title that is in the catalogue but not on
  // the front page is still findable.
  const { videos: hits, loading, error, reload } = useVideoSearch(q)

  useEffect(() => {
    if (q.trim()) recordSearch(q)
  }, [q])

  // Channels match too — "harbour" is as likely to mean the studio as a word in
  // a synopsis, and sending somebody to a list of videos when they wanted the
  // channel is a small failure that repeats every session.
  const channelHits = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return CHANNELS.filter((c) => `${c.name} ${c.handle} ${c.tagline}`.toLowerCase().includes(t)).slice(0, 3)
  }, [q])

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    // The server has already matched the words; what is left is refinement, and
    // it runs over the hits rather than over the catalogue.
    let l = hits.filter((v) => v.billing !== 'PULLED' && v.billing !== 'IN REVIEW')
    if (cat !== 'All') l = l.filter((v) => v.category === cat)
    if (genre !== 'All') l = l.filter((v) => v.genre === genre)
    l = l.filter(DURATION[dur].test)
    if (age !== 'any') {
      const cutoff = now - AGE[age].days * 86_400_000
      l = l.filter((v) => new Date(v.published).getTime() >= cutoff)
    }
    const sorted = [...l]
    if (sort === 'newest') sorted.sort((a, b) => b.published.localeCompare(a.published))
    else if (sort === 'views') sorted.sort((a, b) => b.views - a.views)
    else if (sort === 'longest') sorted.sort((a, b) => seconds(b.runtime) - seconds(a.runtime))
    else if (t)
      // Relevance: a hit in the title beats a hit buried in a synopsis.
      sorted.sort(
        (a, b) =>
          Number(b.title.toLowerCase().includes(t)) - Number(a.title.toLowerCase().includes(t)),
      )
    return sorted
  }, [hits, q, cat, genre, sort, dur, age, now])

  const filters: [string, boolean, () => void][] = [
    [cat, cat !== 'All', () => setCat('All')],
    [genre, genre !== 'All', () => setGenre('All')],
    [DURATION[dur].label, dur !== 'any', () => setDur('any')],
    [AGE[age].label, age !== 'any', () => setAge('any')],
  ]
  const active = filters.filter(([, on]) => on)

  const clearAll = () => {
    setCat('All'); setGenre('All'); setDur('any'); setAge('any'); setSort('relevance')
  }

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-marquee text-[clamp(1.7rem,3.6vw,2.3rem)] font-extrabold tracking-[-0.03em] text-white">
          Search the programme
        </h1>

        <div className="mt-5 max-w-2xl">
          <SearchBox autoFocus initial={q} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" className="w-auto min-w-36">
            <option>All</option>
            {categories.map((c) => <option key={c.id}>{c.name}</option>)}
          </Select>
          {/* The catalogue stores no genre, so this would empty every result it
              was set to. It is shown disabled rather than removed, because the
              filter is a product decision that is still open. */}
          <Select
            value={genre}
            disabled
            title="Genre is not recorded against a title yet."
            onChange={(e) => setGenre(e.target.value)}
            aria-label="Genre"
            className="w-auto min-w-32"
          >
            <option>All</option>
            {GENRES.map((g) => <option key={g}>{g}</option>)}
          </Select>
          <Select value={dur} onChange={(e) => setDur(e.target.value as Duration)} aria-label="Length" className="w-auto min-w-40">
            {(Object.keys(DURATION) as Duration[]).map((d) => (
              <option key={d} value={d}>{DURATION[d].label}</option>
            ))}
          </Select>
          <Select value={age} onChange={(e) => setAge(e.target.value as Age)} aria-label="Published" className="w-auto min-w-36">
            {(Object.keys(AGE) as Age[]).map((a) => (
              <option key={a} value={a}>{AGE[a].label}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SearchSort)} aria-label="Sort by" className="w-auto min-w-36">
            {(Object.keys(SEARCH_SORT) as SearchSort[]).map((k) => (
              <option key={k} value={k}>{SEARCH_SORT[k]}</option>
            ))}
          </Select>
        </div>

        {/* Active filters stay visible as removable chips, so an empty result is
            explained by something you can see and undo rather than by a control
            scrolled out of view. */}
        {active.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {active.map(([label, , clear]) => (
              <button
                key={label}
                onClick={clear}
                className="letterboard flex items-center gap-1.5 rounded-xs border border-ink-600 bg-ink-800 px-2 py-1 text-ink-150 transition-colors hover:border-ink-500 hover:text-white"
              >
                {label}
                <X className="size-3" />
              </button>
            ))}
            <button onClick={clearAll} className="letterboard text-ink-300 underline-offset-4 hover:text-white hover:underline">
              Clear all
            </button>
          </div>
        )}

        {channelHits.length > 0 && (
          <div className="mt-7 border-y border-ink-800 py-5">
            <p className="letterboard mb-3 text-ink-300">Channels</p>
            <ul className="space-y-3">
              {channelHits.map((c) => (
                <li key={c.id}>
                  <Link to={`/channel/${c.handle}`} className="group flex items-center gap-3">
                    <Avatar name={c.name} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-white group-hover:text-violet-200">
                        {c.name}
                      </span>
                      <span className="block truncate text-[12px] text-ink-300">
                        <span className="font-mono">@{c.handle}</span> · {fmt(c.subscribers)} following
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink-300">{c.tagline}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-5 font-mono text-[12px] tabular-nums text-ink-300">
          {loading ? 'Searching' : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
          {q && ` for \u201c${q}\u201d`}
        </p>

        {loading || error ? (
          <div className="mt-8">
            <Resolve loading={loading} error={error} onRetry={reload} what="Searching">
              {null}
            </Resolve>
          </div>
        ) : results.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<SearchX className="size-7" />}
              title="Nothing matched those criteria"
              body="No titles matched your search and filters. Remove a filter above, or try a different word."
              action={<Button onClick={() => { setParams({}); clearAll() }}>Clear everything</Button>}
            />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((v) => <Tile key={v.id} v={v} size="sm" />)}
          </div>
        )}
      </div>
    </FrontOfHouse>
  )
}

export function Category() {
  const { name } = useParams()
  const { videos, loading, error, refresh } = useCatalogue()
  const list = videos.filter((v) => v.category === name && v.billing !== 'PULLED')
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <p className="letterboard text-ink-300">Category</p>
        <h1 className="font-marquee mt-1 text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold tracking-[-0.03em] text-white">
          {name}
        </h1>
        {loading || error ? (
          <div className="mt-8">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Reading the category">
              {null}
            </Resolve>
          </div>
        ) : list.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="Nothing billed here yet" body="No titles currently sit in this category." />
          </div>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((v) => <Tile key={v.id} v={v} />)}
          </div>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ============================================================== the hall */

export function Watch() {
  const nav = useNavigate()
  const { id } = useParams()
  const { video: v, loading, error, reload, setVideo } = useVideo(id)
  const { videos } = useCatalogue()
  const toast = useToast()
  const { viewer } = useSession()
  const actor = actorIdOf(viewer)
  const numericId = id ? videoIdOf(id) : null
  const {
    comments: thread, loading: commentsLoading, error: commentsError,
    post: postComment, remove: removeComment,
  } = useComments(numericId)
  const {
    votes, vote, isSaved, recordWatch,
    isQueued, toggleQueue, isDownloaded, toggleDownload, queue,
  } = useLibrary()
  const [reportOpen, setReportOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [theater, setTheater] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [at, setAt] = useState(0)
  // FR5: the break before the feature is a real advertisement, chosen by the
  // serving engine from what is booked against this title. `undefined` means
  // still resolving, which is why the break is not ended on a falsy id.
  const [adShowing, setAdShowing] = useState(true)
  const backendVideoId = useBackendVideoId(v?.title)
  const [comment, setComment] = useState('')
  const [order, setOrder] = useState<'top' | 'new'>('top')

  const related = useMemo(
    () => (v ? videos.filter((x) => x.id !== v.id && x.category === v.category).slice(0, 6) : []),
    [videos, v],
  )

  // A pinned comment stays first under either order: pinning is the channel's
  // instruction about what to read first, and a sort that overrides it silently
  // undoes a decision somebody deliberately made.
  const comments = useMemo(() => {
    // Replies are shown under their parent, not as separate entries in the list.
    const top = thread.filter((c) => c.parentId == null)
    const rest = top.filter((c) => !c.pinned)
    const sorted = order === 'top' ? [...rest].sort((a, b) => b.likes - a.likes) : rest
    return [...top.filter((c) => c.pinned), ...sorted]
  }, [thread, order])

  // Watching is what puts something in history and what counts as a view, so
  // both are recorded here rather than on any click that happened to lead here.
  // The count is deliberately not awaited: a failed count must not stop playback.
  useEffect(() => {
    if (!v) return
    recordWatch(v.id)
    if (numericId != null) catalogue.countView(numericId).catch(() => {})
  }, [v?.id, numericId])

  // Where you stopped is written back as you watch, so picking the title up on
  // another device lands in the right place. Once a minute is often enough to be
  // useful and rare enough not to be a write per second.
  const lastSaved = useRef(0)
  useEffect(() => {
    if (numericId == null || !viewer || at <= 0) return
    if (at - lastSaved.current < 60 && at > lastSaved.current) return
    lastSaved.current = at
    const total = v ? seconds(v.runtime) : 0
    catalogue.saveProgress(numericId, at, total > 0 && at >= total - 5, actor).catch(() => {})
  }, [at, numericId, actor, viewer])

  if (loading || error || !v) {
    return (
      <FrontOfHouse>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <Resolve loading={loading} error={error} onRetry={reload} what="Opening the title">
            <EmptyState
              title="That title is not in the programme"
              body="The link may be out of date, or the title may have been pulled."
              action={<Button onClick={() => nav('/browse')}>Back to the lobby</Button>}
            />
          </Resolve>
        </div>
      </FrontOfHouse>
    )
  }

  const channel = channelByName(v.creator)
  // A like is the server's record. A dislike is not stored anywhere yet, so it
  // stays in the page and is not claimed to be more than that.
  const my = v.liked ? 'up' : votes[v.id] ?? null

  const like = async () => {
    if (!viewer) return nav('/login')
    if (numericId == null) return
    try {
      const { liked, likeCount } = await catalogue.toggleLike(numericId, actor)
      setVideo((current) => (current ? { ...current, liked, likes: likeCount } : current))
      toast({ title: liked ? 'Liked' : 'Like removed' })
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'Could not record that.', tone: 'bad' })
    }
  }
  const saved = isSaved(v.id)
  const queued = isQueued(v.id)
  const downloaded = isDownloaded(v.id)
  const shareUrl = `${window.location.origin}/watch/${v.id}`

  const copy = (text: string, msg: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast({ title: msg, tone: 'ok' }),
      () => toast({ title: 'Could not reach the clipboard', tone: 'bad' }),
    )
  }

  return (
    <FrontOfHouse>
      <div
        className={cn(
          'mx-auto px-4 py-6 sm:px-6 lg:px-8',
          theater ? 'max-w-none px-0 sm:px-0 lg:px-0' : 'max-w-[1500px]',
        )}
      >
        <div className={cn('grid gap-8', !theater && 'lg:grid-cols-[1fr_360px]')}>
          <div className="min-w-0">
            <div className={cn(theater && 'mx-auto max-w-[1700px]')}>
              {adShowing ? (
                /* ---- pre-roll, served by FR5 and always labelled as advertising ---- */
                <AdSlot
                  videoId={backendVideoId}
                  slot="PREROLL"
                  onFinished={() => setAdShowing(false)}
                />
              ) : (
              <Player
                video={v}
                theater={theater}
                onTheater={setTheater}
                autoplay={autoplay}
                onAutoplay={setAutoplay}
                onTimeChange={setAt}
                onReport={() => setReportOpen(true)}
                onEnded={() => {
                  if (autoplay && related[0]) {
                    toast({ title: `Next: ${related[0].title}` })
                    nav(`/watch/${related[0].id}`)
                  }
                }}
              />
              )}
            </div>

            <div className={cn(theater && 'mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8')}>
              {/* ---- title block ---- */}
              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <BillingBoard billing={v.billing} />
                  <Letterboard>{v.category}</Letterboard>
                  {v.genre && <Letterboard>{v.genre}</Letterboard>}
                  {v.captions.length > 0 && <Letterboard tone="ok">{`CC ${v.captions.join(' · ')}`}</Letterboard>}
                </div>
                <h1 className="font-marquee mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-tight tracking-[-0.03em] text-white">
                  {v.title}
                </h1>
                {tagsFor(v.id).length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {tagsFor(v.id).map((t) => (
                      <Link
                        key={t}
                        to={`/search?q=${encodeURIComponent(t)}`}
                        className="flex items-center text-[13px] text-violet-300 transition-colors hover:text-violet-200"
                      >
                        <Hash className="size-3" />{t}
                      </Link>
                    ))}
                  </p>
                )}

                {/* ---- channel row: the creator is a place you can go ---- */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-ink-800 py-3.5">
                  <Link to={`/channel/${channel?.handle ?? ''}`} className="group flex min-w-0 items-center gap-3">
                    <Avatar name={v.creator} size={40} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate text-[14px] font-medium text-white group-hover:text-violet-200">
                        {v.creator}
                        {isVerified(v.creator) && <VerifiedMark />}
                      </span>
                      <span className="block truncate font-mono text-[11px] tabular-nums text-ink-300">
                        {channel ? `${fmt(channel.subscribers)} following` : ''}
                      </span>
                    </span>
                  </Link>
                  {channel && <SubscribeButton handle={channel.handle} size="sm" />}

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {/* like and dislike share one control, the way a vote works */}
                    <span className="flex items-center overflow-hidden rounded-sm border border-ink-600">
                      <button
                        onClick={like}
                        aria-pressed={my === 'up'}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-ink-800',
                          my === 'up' ? 'text-cyan-300' : 'text-ink-100',
                        )}
                      >
                        <ThumbsUp className={cn('size-4', my === 'up' && 'fill-current')} />
                        <span className="tabular-nums">{fmt(v.likes)}</span>
                      </button>
                      <span className="h-5 w-px bg-ink-700" />
                      <button
                        onClick={() => { vote(v.id, 'down'); toast({ title: my === 'down' ? 'Dislike removed' : 'Disliked' }) }}
                        aria-pressed={my === 'down'}
                        aria-label="Dislike"
                        className={cn(
                          'px-3 py-1.5 transition-colors hover:bg-ink-800',
                          my === 'down' ? 'text-danger-400' : 'text-ink-100',
                        )}
                      >
                        <ThumbsDown className={cn('size-4', my === 'down' && 'fill-current')} />
                      </button>
                    </span>

                    <Button size="sm" icon={<Share2 className="size-4" />} onClick={() => setShareOpen(true)}>
                      Share
                    </Button>
                    <Button
                      size="sm"
                      icon={<Bookmark className={cn('size-4', saved && 'fill-current')} />}
                      onClick={() => (viewer ? setSaveOpen(true) : nav('/login'))}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      icon={<ListEnd className={cn('size-4', queued && 'text-cyan-300')} />}
                      onClick={() => {
                        if (!viewer) return nav('/login')
                        const added = toggleQueue(v.id)
                        toast({ title: added ? 'Added to the queue' : 'Removed from the queue' })
                      }}
                    >
                      {queued ? 'Queued' : 'Queue'}
                    </Button>
                    <Button
                      size="sm"
                      icon={<Download className={cn('size-4', downloaded && 'text-cyan-300')} />}
                      onClick={() => {
                        if (!viewer) return nav('/login')
                        const on = toggleDownload(v.id)
                        toast({
                          title: on
                            ? 'Taken for offline viewing'
                            : 'Removed from offline titles',
                          tone: on ? 'ok' : undefined,
                        })
                      }}
                    >
                      {downloaded ? 'Offline' : 'Download'}
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Flag className="size-4" />} onClick={() => setReportOpen(true)}>
                      Report
                    </Button>
                  </div>
                </div>

                {/* ---- description ---- */}
                <div className="mt-4 rounded-lg bg-ink-850 p-4">
                  <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-ink-300">
                    <span className="font-mono tabular-nums text-ink-150">{fmt(v.views)} views</span>
                    <span aria-hidden>·</span>
                    <span>published {v.published}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono tabular-nums">{v.runtime}</span>
                  </p>
                  <p className="mt-2.5 max-w-[70ch] text-[15px] leading-relaxed text-ink-200">
                    {v.synopsis}
                  </p>
                </div>

                <ChapterList video={v} />
              </div>

              {/* ---- comments ---- */}
              <div className="mt-10 border-t border-ink-800 pt-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-marquee text-[17px] font-bold text-white">
                    {commentsLoading ? 'Comments' : `${fmt(thread.length)} comments`}
                  </h2>
                  <div className="flex items-center gap-1">
                    {(['top', 'new'] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => setOrder(o)}
                        className={cn(
                          'letterboard rounded-xs px-2 py-1 transition-colors',
                          order === o ? 'bg-ink-800 text-white' : 'text-ink-300 hover:text-white',
                        )}
                      >
                        {o === 'top' ? 'Top' : 'Newest'}
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const text = comment.trim()
                    if (!text) return
                    try {
                      await postComment(text)
                      setComment('')
                      toast({ title: 'Comment posted', tone: 'ok' })
                    } catch (cause) {
                      // The box keeps what was typed, because losing it to a
                      // failed request is the worst possible response to one.
                      toast({
                        title: cause instanceof ApiError ? cause.message : 'Could not post that.',
                        tone: 'bad',
                      })
                    }
                  }}
                  className="mt-5 flex gap-3"
                >
                  <Avatar name={viewer?.name ?? 'Guest'} />
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={viewer ? 'Add a comment' : 'Sign in to comment'}
                      disabled={!viewer}
                      className="min-h-16"
                    />
                    {viewer && (
                      <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" variant="quiet" onClick={() => setComment('')} type="button">
                          Cancel
                        </Button>
                        <Button size="sm" variant="primary" type="submit" disabled={!comment.trim()}>
                          Comment
                        </Button>
                      </div>
                    )}
                  </div>
                </form>

                {commentsLoading || commentsError ? (
                  <Resolve loading={commentsLoading} error={commentsError} what="Reading the comments">
                    {null}
                  </Resolve>
                ) : comments.length === 0 ? (
                  <p className="mt-6 text-[14px] text-ink-300">
                    No comments yet. {viewer ? 'Be the first.' : 'Sign in to be the first.'}
                  </p>
                ) : (
                <ul className="mt-6 space-y-5">
                  {comments.map((c) => (
                    <li
                      key={c.id}
                      className={cn(
                        'flex gap-3',
                        c.pinned && 'rounded-lg border border-ink-700 bg-ink-850 p-3.5',
                      )}
                    >
                      <Avatar name={c.who} />
                      <div className="min-w-0 flex-1">
                        {c.pinned && (
                          <p className="letterboard mb-1.5 flex items-center gap-1.5 text-ink-300">
                            <Pin className="size-3" />
                            Pinned by {v.creator}
                          </p>
                        )}
                        <p className="flex flex-wrap items-center gap-2 text-[13px]">
                          <span
                            className={cn(
                              'flex items-center gap-1.5 font-medium',
                              c.byCreator
                                ? 'rounded-full bg-ink-700 px-2 py-0.5 text-white'
                                : 'text-white',
                            )}
                          >
                            {c.who}
                            {isVerified(c.who) && <VerifiedMark />}
                          </span>
                          <span className="text-ink-300">{c.at}</span>
                        </p>
                        <p className="mt-1 text-[14px] leading-relaxed text-ink-200">{c.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-ink-300">
                          <button className="flex items-center gap-1 transition-colors hover:text-white">
                            <ThumbsUp className="size-3.5" />
                            <span className="tabular-nums">{fmt(c.likes)}</span>
                          </button>
                          <button aria-label="Dislike this comment" className="transition-colors hover:text-white">
                            <ThumbsDown className="size-3.5" />
                          </button>
                          {(() => {
                            const replies = thread.filter((r) => r.parentId === c.id)
                            return replies.length > 0 ? (
                              <span className="flex items-center gap-1 text-cyan-300">
                                <ChevronRight className="size-3.5" />
                                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                              </span>
                            ) : null
                          })()}
                          {/* Only your own comment can be taken down here; a
                              channel removing somebody else's is moderation, and
                              that lives in the moderation queue. */}
                          {c.userId != null && c.userId === actor && (
                            <button
                              className="ml-auto flex items-center gap-1 transition-colors hover:text-danger-400"
                              onClick={async () => {
                                try {
                                  await removeComment(c.id)
                                  toast({ title: 'Comment removed' })
                                } catch (cause) {
                                  toast({
                                    title: cause instanceof ApiError ? cause.message : 'Could not remove it.',
                                    tone: 'bad',
                                  })
                                }
                              }}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                )}
              </div>
            </div>
          </div>

          {/* ---- up next ---- */}
          {!theater && (
            <aside className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="letterboard text-ink-300">
                  Up next
                  {queue.length > 0 && (
                    <Link to="/queue-up" className="ml-2 text-cyan-300 hover:underline">
                      In queue: {queue.length}
                    </Link>
                  )}
                </p>
                <span className="letterboard text-ink-300">
                  Autoplay {autoplay ? 'on' : 'off'}
                </span>
              </div>
              <ul className="space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/watch/${r.id}`} className="group flex gap-3">
                      <span className="w-32 shrink-0 overflow-hidden rounded-xs">
                        <span className="block aspect-video">
                          <PosterPlate title={r.title} seed={r.seed} category={r.category} compact lettering={false} />
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="font-marquee block truncate text-[14px] font-bold text-white group-hover:text-violet-200">
                          {r.title}
                        </span>
                        <span className="block truncate text-[12px] text-ink-300">{r.creator}</span>
                        <span className="block font-mono text-[11px] tabular-nums text-ink-300">
                          {fmt(r.views)} views · {r.runtime}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} title={v.title} />
      <SaveToPlaylist videoId={v.id} open={saveOpen} onClose={() => setSaveOpen(false)} />

      {/* ---- share, with the option to start where the viewer is ---- */}
      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title={`Share ${v.title}`}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-900 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-200">{shareUrl}</span>
            <Button size="sm" onClick={() => copy(shareUrl, 'Link copied')}>Copy</Button>
          </div>
          <div className="flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-900 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-200">
              {shareUrl}?t={Math.round(at)}
            </span>
            <Button size="sm" onClick={() => copy(`${shareUrl}?t=${Math.round(at)}`, `Link copied, starting at ${clock(at)}`)}>
              Copy
            </Button>
          </div>
          <p className="text-[13px] text-ink-300">
            The second link opens at <span className="font-mono tabular-nums text-ink-150">{clock(at)}</span>,
            where you are now.
          </p>
        </div>
      </Modal>
    </FrontOfHouse>
  )
}

export function ReportModal({
  open,
  onClose,
  title,
}: {
  open: boolean
  onClose: () => void
  title?: string
}) {
  const toast = useToast()
  const [type, setType] = useState('')
  const [detail, setDetail] = useState('')
  const [err, setErr] = useState('')

  const submit = () => {
    if (!type) return setErr('Choose what kind of problem this is.')
    if (detail.trim().length < 10)
      return setErr('Describe the problem in a sentence or two so it can be investigated.')
    setErr('')
    toast({ title: 'Report submitted — you can track it under My reports', tone: 'ok' })
    setType('')
    setDetail('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report a problem"
      description={title ? `About “${title}”` : undefined}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Submit report</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What kind of problem?" required error={err && !type ? err : undefined}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Choose one</option>
            <option>Inappropriate content</option>
            <option>Playback problem</option>
            <option>Accessibility</option>
            <option>Other</option>
          </Select>
        </Field>
        <Field
          label="What happened?"
          required
          hint={`${detail.length}/500`}
          error={err && type ? err : undefined}
        >
          <Textarea
            value={detail}
            maxLength={500}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Include the timestamp if it helps — for example, “captions drift from 04:12”."
          />
        </Field>
        <p className="text-[12.5px] leading-relaxed text-ink-300">
          Support sees your report with a status you can follow. You will be notified when the
          status changes.
        </p>
      </div>
    </Modal>
  )
}

/* ============================================================== watchlist */

export function Watchlist() {
  const nav = useNavigate()
  const { watchLater, toggleWatchLater } = useLibrary()
  const { byId, loading, error, refresh } = useCatalogue()
  const toast = useToast()
  const list = watchLater.map((id) => byId(id)).filter(Boolean) as Video[]
  const total = clock(list.reduce((s, v) => s + seconds(v.runtime), 0))

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-marquee text-[clamp(1.8rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          Watch later
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[15px] text-ink-300">
          <span>Titles you saved for later.</span>
          {list.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="font-mono tabular-nums">{list.length} titles, {total}</span>
            </>
          )}
        </p>

        {loading || error ? (
          <div className="mt-8">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Reading your list">
              {null}
            </Resolve>
          </div>
        ) : list.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Bookmark className="size-7" />}
              title="Nothing saved yet"
              body="Save a title from anywhere in the programme and it will wait for you here."
              action={<Button onClick={() => nav('/browse')}>Browse the lobby</Button>}
            />
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<Play className="size-4 fill-current" />}
                onClick={() => nav(`/watch/${list[0].id}`)}
              >
                Play all
              </Button>
            </div>
            <ul className="mt-6 divide-y divide-ink-800">
              {list.map((v, i) => (
                <li key={v.id} className="group flex items-center gap-4 py-4">
                  <span className="hidden w-6 shrink-0 text-center font-mono text-[12px] tabular-nums text-ink-300 sm:block">
                    {i + 1}
                  </span>
                  <Link to={`/watch/${v.id}`} className="w-32 shrink-0 overflow-hidden rounded-xs sm:w-40">
                    <span className="block aspect-video">
                      <PosterPlate title={v.title} seed={v.seed} category={v.category} compact lettering={false} />
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/watch/${v.id}`} className="font-marquee block truncate text-[17px] font-bold text-white hover:text-violet-200">
                      {v.title}
                    </Link>
                    <p className="truncate text-[13px] text-ink-300">
                      {v.creator} · <span className="font-mono tabular-nums">{fmt(v.views)} views</span>
                    </p>
                  </div>
                  <span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-ink-300 sm:block">
                    {v.runtime}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="size-4" />}
                    onClick={() => {
                      toggleWatchLater(v.id)
                      toast({ title: `${v.title} removed` })
                    }}
                  >
                    <span className="sr-only sm:not-sr-only">Remove</span>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ================================================================ history */

export function History() {
  const nav = useNavigate()
  const toast = useToast()
  const { history, forgetWatch, clearHistory, historyPaused, setHistoryPaused } = useLibrary()
  const { byId, loading, error, refresh } = useCatalogue()
  const [confirm, setConfirm] = useState(false)
  const list = history.map((id) => byId(id)).filter(Boolean) as Video[]

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-marquee text-[clamp(1.8rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
              Watch history
            </h1>
            <p className="mt-2 text-[15px] text-ink-300">Pick up where you stopped.</p>
          </div>
          {list.length > 0 && (
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
              Clear all
            </Button>
          )}
        </div>

        {/* Pausing is separate from clearing. One stops the recording, the other
            destroys what was recorded, and conflating them is how people lose
            things they meant to keep. */}
        <div className="mt-5 max-w-xl rounded-lg border border-ink-700 bg-ink-850 p-4">
          <Toggle
            checked={historyPaused}
            onChange={(v) => {
              setHistoryPaused(v)
              toast({ title: v ? 'History paused' : 'History resumed' })
            }}
            label="Pause watch history"
            description="Nothing new is recorded while this is on. What is already here stays, and recommendations keep using it."
          />
        </div>

        {loading || error ? (
          <div className="mt-8">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Reading your history">
              {null}
            </Resolve>
          </div>
        ) : list.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Clock className="size-7" />}
              title="No viewing history"
              body="Once you start watching, your place is kept here so you can resume."
              action={<Button onClick={() => nav('/browse')}>Find something to watch</Button>}
            />
          </div>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((v) => (
              <div key={v.id} className="group relative">
                <Tile v={v} />
                <button
                  aria-label={`Remove ${v.title} from history`}
                  onClick={() => {
                    forgetWatch(v.id)
                    toast({ title: 'Removed from history' })
                  }}
                  className="absolute right-2 top-2 rounded-sm bg-ink-950/80 p-1.5 text-ink-200 opacity-0 backdrop-blur transition-opacity hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
                {typeof v.progress === 'number' && (
                  <div className="mt-2">
                    <Meter value={v.progress} tone="accent" />
                    <p className="mt-1.5 font-mono text-[11px] tabular-nums text-ink-300">
                      {Math.round(v.progress * 100)}% watched · resume
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Clear all watch history?"
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                clearHistory()
                setConfirm(false)
                toast({ title: 'Watch history cleared', tone: 'bad' })
              }}
            >
              Clear everything
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          Every title and every saved position goes. Recommendations will have less to work from
          until you watch something again. This cannot be undone.
        </p>
      </Modal>
    </FrontOfHouse>
  )
}

/* ================================================================ for you */

export function ForYou() {
  const nav = useNavigate()
  const { videos, loading, error, refresh } = useCatalogue()
  const personalised = videos.filter((v) => v.billing === 'NOW SHOWING')
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-marquee text-[clamp(1.8rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          For you
        </h1>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-300">
          Built from the categories you chose and what you have actually watched. No machine
          learning is involved — these are rule-based matches, and you can change what feeds them.
        </p>
        <div className="mt-4">
          <Button size="sm" onClick={() => nav('/settings/notifications')}>
            Adjust what feeds this
          </Button>
        </div>

        {loading || error ? (
          <div className="mt-8">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Building your shelf">
              {null}
            </Resolve>
          </div>
        ) : personalised.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Nothing to recommend yet"
              body="There is nothing currently showing to build a shelf from. Once titles are published they appear here."
            />
          </div>
        ) : (
          <>
            <div className="mt-8">
              <Section title="Because you watched Documentary">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {personalised.slice(0, 4).map((v) => <Tile key={v.id} v={v} />)}
                </div>
              </Section>
            </div>
            {personalised.length > 2 && (
              <div className="mt-10">
                <Section title="Popular with Season Pass holders">
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {personalised.slice(2, 6).map((v) => <Tile key={v.id} v={v} />)}
                  </div>
                </Section>
              </div>
            )}
          </>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* =========================================================== notifications */

export function Notifications() {
  const nav = useNavigate()
  const [items, setItems] = useState(NOTIFICATIONS)
  const [tab, setTab] = useState('all')
  const shown = tab === 'all' ? items : items.filter((i) => !i.read)

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-marquee text-[clamp(1.8rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
            Notifications
          </h1>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setItems((x) => x.map((i) => ({ ...i, read: true })))}>
              Mark all read
            </Button>
            <Button size="sm" variant="ghost" onClick={() => nav('/settings/notifications')}>
              Preferences
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: 'All', count: items.length },
              { id: 'unread', label: 'Unread', count: items.filter((i) => !i.read).length },
            ]}
          />
        </div>

        {shown.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<Bell className="size-7" />} title="Nothing unread" body="You are all caught up." />
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-ink-800">
            {shown.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-4">
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    n.read ? 'bg-ink-600' : 'bg-cyan-400',
                  )}
                  aria-label={n.read ? 'Read' : 'Unread'}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-white">{n.title}</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-ink-300">{n.body}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-300">{n.at}</p>
                </div>
                <button
                  aria-label="Remove notification"
                  onClick={() => setItems((x) => x.filter((i) => i.id !== n.id))}
                  className="rounded-xs p-1 text-ink-300 hover:bg-ink-800 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ------------------------------------------------------ notification prefs */

export function NotificationPrefs() {
  const [prefs, setPrefs] = useState({
    newVideo: true, subscription: true, complaint: true, announcement: false, recommendations: true,
  })
  const toast = useToast()
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-marquee text-[clamp(1.7rem,3.4vw,2.2rem)] font-extrabold tracking-[-0.03em] text-white">
          Notification preferences
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-300">
          Turn off anything you do not want. Reports you have submitted always notify you when their
          status changes.
        </p>
        <div className="mt-7 divide-y divide-ink-800 border-y border-ink-800">
          <Toggle label="New titles" description="When a creator you follow publishes something." checked={prefs.newVideo} onChange={(v) => setPrefs({ ...prefs, newVideo: v })} />
          <Toggle label="Pass and payment" description="Renewals, plan changes, receipts and failures." checked={prefs.subscription} onChange={(v) => setPrefs({ ...prefs, subscription: v })} />
          <Toggle label="Report status" description="Always on — you are told what happened to reports you filed." checked={prefs.complaint} onChange={() => toast({ title: 'Report status notifications cannot be turned off' })} />
          <Toggle label="Platform announcements" description="Maintenance windows and platform news." checked={prefs.announcement} onChange={(v) => setPrefs({ ...prefs, announcement: v })} />
          <Toggle label="Recommendations" description="Let your history and chosen categories shape For you." checked={prefs.recommendations} onChange={(v) => setPrefs({ ...prefs, recommendations: v })} />
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={() => toast({ title: 'Preferences saved', tone: 'ok' })}>
            Save preferences
          </Button>
        </div>
      </div>
    </FrontOfHouse>
  )
}

/* ================================================================ profile */

export function Profile() {
  const toast = useToast()
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-marquee text-[clamp(1.7rem,3.4vw,2.2rem)] font-extrabold tracking-[-0.03em] text-white">
          Account
        </h1>
        <div className="mt-7 flex items-center gap-4">
          <Avatar name="You There" size={64} />
          <div>
            <Button size="sm">Change picture</Button>
            <p className="mt-1.5 text-[12px] text-ink-300">PNG or JPG. Maximum size not yet decided.</p>
          </div>
        </div>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => { e.preventDefault(); toast({ title: 'Profile updated', tone: 'ok' }) }}
        >
          <Field label="Display name"><Input defaultValue="You There" /></Field>
          <Field label="Email"><Input type="email" defaultValue="you@example.com" /></Field>
          <Field label="Language" hint="English only in this version">
            <Select defaultValue="en"><option value="en">English</option></Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="quiet" type="button">Discard</Button>
            <Button variant="primary" type="submit">Save changes</Button>
          </div>
        </form>

        <div className="mt-12 rounded-lg border border-danger-500/30 bg-danger-500/6 p-5">
          <h2 className="font-marquee text-[17px] font-bold text-danger-400">Close your account</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-300">
            Your comments and watch history are removed. Any active pass is cancelled at the end of
            its current period. This cannot be undone.
          </p>
          <Button variant="danger" className="mt-4">Close account</Button>
        </div>
      </div>
    </FrontOfHouse>
  )
}

/* =================================================================== help */

export function Help() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const faqs = [
    ['Why can I not play a premium title?', 'Premium titles need an active pass. Check your pass under Account → Pass, or claim one from the Passes page.'],
    ['A video keeps buffering.', 'Playback quality follows your connection speed. If it persists, report it as a playback problem so support can check the transcode.'],
    ['How do I turn captions on?', 'Use the CC control in the player. Caption tracks are listed under the title when a video has them.'],
    ['Where do I see a report I filed?', 'Under My reports. You will also be notified whenever its status changes.'],
    ['Can I watch offline?', 'Not in this version. Skopia needs a live connection to stream.'],
  ]
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-marquee text-[clamp(1.7rem,3.4vw,2.2rem)] font-extrabold tracking-[-0.03em] text-white">
          Help & support
        </h1>
        <p className="mt-2 text-[15px] text-ink-300">Common questions, and how to reach a person.</p>

        <div className="mt-7 divide-y divide-ink-800 border-y border-ink-800">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-white">
                {q}
                <ChevronRight className="size-4 shrink-0 text-ink-300 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-2.5 text-[14px] leading-relaxed text-ink-300">{a}</p>
            </details>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-ink-700 bg-ink-850 p-5">
          <h2 className="font-marquee text-[17px] font-bold text-white">Still stuck?</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-300">
            File a complaint and a support officer will pick it up. You can follow its status the
            whole way through.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={<LifeBuoy className="size-4" />} onClick={() => setOpen(true)}>
              Contact support
            </Button>
            <Button onClick={() => nav('/reports')}>See my reports</Button>
          </div>
        </div>
      </div>
      <ReportModal open={open} onClose={() => setOpen(false)} />
    </FrontOfHouse>
  )
}
