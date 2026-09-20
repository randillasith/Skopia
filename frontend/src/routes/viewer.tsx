import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Play, Bookmark, Share2, Flag, ThumbsUp, ThumbsDown, Trash2, SearchX, Clock,
  Bell, LifeBuoy, ChevronRight, X,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Textarea, SearchInput, Toggle, EmptyState,
  Modal, Section, Avatar, Meter, useToast, Tabs,
} from '@/components/primitives'
import { PosterPlate, Lightbox, BillingBoard, Letterboard } from '@/components/world'
import { Player, ChapterList } from '@/components/player'
import { FrontOfHouse, useSession } from '@/components/Shell'
import {
  VIDEOS, CATEGORIES, GENRES, COMMENTS, NOTIFICATIONS, byId, fmt, clock,
  continueWatching, type Video,
} from '@/lib/data'
import { channelByName } from '@/lib/session'
import { useLibrary } from '@/lib/library'
import { SubscribeButton } from './channel'
import { SaveToPlaylist } from './playlists'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------- poster tile */

export function Tile({ v, size = 'md' }: { v: Video; size?: 'lg' | 'md' | 'sm' }) {
  return (
    <article className="group min-w-0">
      <Lightbox interactive>
        <Link to={`/watch/${v.id}`} className="block aspect-video" aria-label={`Play ${v.title}`}>
          <PosterPlate title={v.title} seed={v.seed} category={v.category} compact />
          {typeof v.progress === 'number' && (
            <span className="absolute inset-x-0 bottom-0 block h-0.5 bg-ink-700">
              <span
                className="block h-full bg-cyan-400"
                style={{ width: `${v.progress * 100}%` }}
              />
            </span>
          )}
          {v.premium && (
            <span className="letterboard absolute right-2 top-2 rounded-xs border border-gold-500/40 bg-ink-950/80 px-1.5 py-0.5 text-gold-400 backdrop-blur">
              Pass
            </span>
          )}
        </Link>
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
        <p className="mt-0.5 truncate text-[13px] text-ink-300">
          {v.creator} · <span className="font-mono tabular-nums">{v.runtime}</span>
        </p>
      </div>
    </article>
  )
}

/* ================================================================== browse */

export function Browse() {
  const nav = useNavigate()
  const [cat, setCat] = useState<string>('All')
  const [sort, setSort] = useState('popular')

  const list = useMemo(() => {
    let l = VIDEOS.filter((v) => v.billing !== 'PULLED' && v.billing !== 'IN REVIEW')
    if (cat !== 'All') l = l.filter((v) => v.category === cat)
    if (sort === 'popular') l = [...l].sort((a, b) => b.views - a.views)
    if (sort === 'newest') l = [...l].sort((a, b) => b.published.localeCompare(a.published))
    if (sort === 'title') l = [...l].sort((a, b) => a.title.localeCompare(b.title))
    return l
  }, [cat, sort])

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
          {['All', ...CATEGORIES].map((c) => (
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

        {list.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<SearchX className="size-7" />}
              title="Nothing in that category yet"
              body="No titles are currently billed under this category. Try another, or see the whole programme."
              action={<Button onClick={() => setCat('All')}>Show everything</Button>}
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
                  <Button icon={<Bookmark className="size-4" />}>Watchlist</Button>
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

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [cat, setCat] = useState('All')
  const [genre, setGenre] = useState('All')

  const results = useMemo(() => {
    let l = VIDEOS.filter((v) => v.billing !== 'PULLED')
    if (q.trim())
      l = l.filter((v) =>
        `${v.title} ${v.creator} ${v.category} ${v.genre} ${v.synopsis}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      )
    if (cat !== 'All') l = l.filter((v) => v.category === cat)
    if (genre !== 'All') l = l.filter((v) => v.genre === genre)
    return l
  }, [q, cat, genre])

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-marquee text-[clamp(1.7rem,3.6vw,2.3rem)] font-extrabold tracking-[-0.03em] text-white">
          Search the programme
        </h1>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <SearchInput
            autoFocus
            value={q}
            placeholder="Title, creator, category or genre"
            aria-label="Search"
            onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})}
            className="flex-1"
          />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" className="sm:w-44">
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre" className="sm:w-40">
            <option>All</option>
            {GENRES.map((g) => <option key={g}>{g}</option>)}
          </Select>
        </div>

        <p className="mt-4 font-mono text-[12px] tabular-nums text-ink-300">
          {results.length} {results.length === 1 ? 'result' : 'results'}
          {q && ` for “${q}”`}
        </p>

        {results.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<SearchX className="size-7" />}
              title="Nothing matched those criteria"
              body="No titles matched your search and filters. Clear a filter, or try a different word."
              action={
                <Button
                  onClick={() => {
                    setParams({})
                    setCat('All')
                    setGenre('All')
                  }}
                >
                  Clear everything
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {results.map((v) => <Tile key={v.id} v={v} />)}
          </div>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ================================================================ category */

export function Category() {
  const { name } = useParams()
  const list = VIDEOS.filter((v) => v.category === name && v.billing !== 'PULLED')
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <p className="letterboard text-ink-300">Category</p>
        <h1 className="font-marquee mt-1 text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold tracking-[-0.03em] text-white">
          {name}
        </h1>
        {list.length === 0 ? (
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
  const v = byId(id ?? '')
  const toast = useToast()
  const { viewer } = useSession()
  const { votes, vote, isSaved, recordWatch } = useLibrary()
  const [reportOpen, setReportOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [theater, setTheater] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [at, setAt] = useState(0)
  const [comment, setComment] = useState('')
  const [order, setOrder] = useState<'top' | 'new'>('top')

  const related = useMemo(
    () => (v ? VIDEOS.filter((x) => x.id !== v.id && x.category === v.category).slice(0, 6) : []),
    [v],
  )

  // Watching is what puts something in history, so it is recorded here rather
  // than on any click that happened to lead here.
  useEffect(() => {
    if (v) recordWatch(v.id)
  }, [v?.id])

  if (!v) {
    return (
      <FrontOfHouse>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <EmptyState
            title="That title is not in the programme"
            body="The link may be out of date, or the title may have been pulled."
            action={<Button onClick={() => nav('/browse')}>Back to the lobby</Button>}
          />
        </div>
      </FrontOfHouse>
    )
  }

  const channel = channelByName(v.creator)
  const my = votes[v.id] ?? null
  const saved = isSaved(v.id)
  const comments = order === 'top' ? [...COMMENTS].sort((a, b) => b.likes - a.likes) : COMMENTS
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
            </div>

            <div className={cn(theater && 'mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8')}>
              {/* ---- title block ---- */}
              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <BillingBoard billing={v.billing} />
                  <Letterboard>{v.category}</Letterboard>
                  <Letterboard>{v.genre}</Letterboard>
                  {v.captions.length > 0 && <Letterboard tone="ok">{`CC ${v.captions.join(' · ')}`}</Letterboard>}
                </div>
                <h1 className="font-marquee mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-tight tracking-[-0.03em] text-white">
                  {v.title}
                </h1>

                {/* ---- channel row: the creator is a place you can go ---- */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-ink-800 py-3.5">
                  <Link to={`/channel/${channel?.handle ?? ''}`} className="group flex min-w-0 items-center gap-3">
                    <Avatar name={v.creator} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-white group-hover:text-violet-200">
                        {v.creator}
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
                        onClick={() => { vote(v.id, 'up'); toast({ title: my === 'up' ? 'Like removed' : 'Liked' }) }}
                        aria-pressed={my === 'up'}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-ink-800',
                          my === 'up' ? 'text-cyan-300' : 'text-ink-100',
                        )}
                      >
                        <ThumbsUp className={cn('size-4', my === 'up' && 'fill-current')} />
                        <span className="tabular-nums">{fmt(v.likes + (my === 'up' ? 1 : 0))}</span>
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
                    {fmt(v.comments)} comments
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
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!comment.trim()) return
                    setComment('')
                    toast({ title: 'Comment posted', tone: 'ok' })
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

                <ul className="mt-6 space-y-5">
                  {comments.map((c) => {
                    const byCreator = c.who === v.creator
                    return (
                      <li key={c.id} className="flex gap-3">
                        <Avatar name={c.who} />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className={cn('font-medium', byCreator ? 'rounded-xs bg-ink-700 px-1.5 py-0.5 text-white' : 'text-white')}>
                              {c.who}
                            </span>
                            <span className="text-ink-300">{c.at}</span>
                          </p>
                          <p className="mt-1 text-[14px] leading-relaxed text-ink-200">{c.body}</p>
                          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-ink-300">
                            <button className="flex items-center gap-1 hover:text-white">
                              <ThumbsUp className="size-3.5" /> {c.likes}
                            </button>
                            <button className="hover:text-white">Reply</button>
                            <button className="hover:text-danger-400" onClick={() => toast({ title: 'Comment reported to the channel' })}>
                              Report
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* ---- up next ---- */}
          {!theater && (
            <aside className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="letterboard text-ink-300">Up next</p>
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
  const [list, setList] = useState(VIDEOS.slice(1, 5))
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-marquee text-[clamp(1.8rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          Watchlist
        </h1>
        <p className="mt-2 text-[15px] text-ink-300">Titles you saved for later.</p>
        {list.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Bookmark className="size-7" />}
              title="Your watchlist is empty"
              body="Save a title from anywhere in the programme and it will wait for you here."
              action={<Button onClick={() => nav('/browse')}>Browse the lobby</Button>}
            />
          </div>
        ) : (
          <ul className="mt-7 divide-y divide-ink-800">
            {list.map((v) => (
              <li key={v.id} className="flex items-center gap-4 py-4">
                <Link to={`/watch/${v.id}`} className="w-32 shrink-0 overflow-hidden rounded-xs">
                  <span className="block aspect-video"><PosterPlate title={v.title} seed={v.seed} category={v.category} compact lettering={false} /></span>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/watch/${v.id}`} className="font-marquee block truncate text-[17px] font-bold text-white hover:text-violet-200">
                    {v.title}
                  </Link>
                  <p className="truncate text-[13px] text-ink-300">{v.creator} · {v.runtime}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="size-4" />}
                  onClick={() => setList((l) => l.filter((x) => x.id !== v.id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ================================================================ history */

export function History() {
  const nav = useNavigate()
  const [list, setList] = useState(continueWatching)
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
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setList([])}>
              Clear history
            </Button>
          )}
        </div>
        {list.length === 0 ? (
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
              <div key={v.id}>
                <Tile v={v} />
                <div className="mt-2">
                  <Meter value={v.progress ?? 0} tone="accent" />
                  <p className="mt-1.5 font-mono text-[11px] tabular-nums text-ink-300">
                    {Math.round((v.progress ?? 0) * 100)}% watched · resume
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ================================================================ for you */

export function ForYou() {
  const nav = useNavigate()
  const personalised = VIDEOS.filter((v) => v.billing === 'NOW SHOWING')
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

        <div className="mt-8">
          <Section title="Because you watched Documentary">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {personalised.slice(0, 4).map((v) => <Tile key={v.id} v={v} />)}
            </div>
          </Section>
        </div>
        <div className="mt-10">
          <Section title="Popular with Season Pass holders">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {personalised.slice(2, 6).map((v) => <Tile key={v.id} v={v} />)}
            </div>
          </Section>
        </div>
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
