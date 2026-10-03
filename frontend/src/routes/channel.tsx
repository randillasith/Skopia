import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Bell, BellOff, Check, Users, Play, MapPin, CalendarDays } from 'lucide-react'
import { Button, Tabs, EmptyState, Select, useToast, Avatar } from '@/components/primitives'
import { PosterPlate, Lightbox, Letterboard, MarqueeRule } from '@/components/world'
import { FrontOfHouse, useSession } from '@/components/Shell'
import { fmt, seconds, type Video } from '@/lib/data'
import { useCatalogue } from '@/lib/useCatalogue'
import { Resolve } from '@/components/Loading'
import { CHANNELS, channelByHandle } from '@/lib/session'
import { useLibrary } from '@/lib/library'
import { Tile } from './viewer'

/* ------------------------------------------------------------- subscribing */

/**
 * Subscribe, and the bell beside it.
 *
 * The bell only appears once you follow the channel, because a notification
 * preference for a channel you do not follow has nothing to fire on. Following
 * is free and needs no pass — it is the account, not the subscription, that
 * makes it possible, which is why this asks you to sign in rather than to pay.
 */
export function SubscribeButton({
  handle,
  size = 'md',
}: {
  handle: string
  size?: 'sm' | 'md'
}) {
  const { viewer } = useSession()
  const { isSubscribed, toggleSubscribe, bells, toggleBell } = useLibrary()
  const toast = useToast()
  const nav = useNavigate()
  const channel = channelByHandle(handle)
  const on = isSubscribed(handle)
  const belled = bells.includes(handle)

  if (!viewer) {
    return (
      <Button size={size} variant="primary" onClick={() => nav('/login')}>
        Sign in to follow
      </Button>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <Button
        size={size}
        variant={on ? 'secondary' : 'primary'}
        icon={on ? <Check className="size-4" /> : undefined}
        onClick={() => {
          const nowOn = toggleSubscribe(handle)
          toast({
            title: nowOn
              ? `Following ${channel?.name ?? handle}`
              : `No longer following ${channel?.name ?? handle}`,
            tone: nowOn ? 'ok' : undefined,
          })
        }}
      >
        {on ? 'Following' : 'Follow'}
      </Button>
      {on && (
        <Button
          size={size}
          variant="ghost"
          aria-pressed={belled}
          aria-label={belled ? 'Turn off new-release alerts' : 'Alert me to new releases'}
          onClick={() => {
            const nowOn = toggleBell(handle)
            toast({
              title: nowOn
                ? 'You will be told about new releases'
                : 'New-release alerts turned off',
            })
          }}
        >
          {belled ? <Bell className="size-4 fill-current" /> : <BellOff className="size-4" />}
        </Button>
      )}
    </span>
  )
}

/* --------------------------------------------------------------- the page */

type Sort = 'recent' | 'popular' | 'oldest' | 'longest'

const SORTS: Record<Sort, { label: string; cmp: (a: Video, b: Video) => number }> = {
  recent: { label: 'Newest first', cmp: (a, b) => b.published.localeCompare(a.published) },
  popular: { label: 'Most watched', cmp: (a, b) => b.views - a.views },
  oldest: { label: 'Oldest first', cmp: (a, b) => a.published.localeCompare(b.published) },
  longest: { label: 'Longest first', cmp: (a, b) => seconds(b.runtime) - seconds(a.runtime) },
}

export function ChannelPage() {
  const { handle } = useParams()
  const nav = useNavigate()
  const channel = handle ? channelByHandle(handle) : null
  const [tab, setTab] = useState('videos')
  const [sort, setSort] = useState<Sort>('recent')
  const { isSubscribed } = useLibrary()
  // Channels themselves have no backend, but their titles do — the shelf is the
  // catalogue filtered to what this channel published.
  const { videos, loading, error, refresh } = useCatalogue()

  const all = useMemo(
    () => (channel ? videos.filter((v) => v.creator === channel.name) : []),
    [videos, channel],
  )
  // A channel page is public, so it shows what a visitor could actually play.
  const published = useMemo(
    () => all.filter((v) => v.billing !== 'IN REVIEW' && v.billing !== 'PULLED'),
    [all],
  )
  const sorted = useMemo(() => [...published].sort(SORTS[sort].cmp), [published, sort])
  const featured = sorted[0]

  if (!channel) {
    return (
      <FrontOfHouse>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <EmptyState
            title="No such channel"
            body="The link may be out of date, or the channel may have been closed."
            action={<Button onClick={() => nav('/browse')}>Back to the programme</Button>}
          />
        </div>
      </FrontOfHouse>
    )
  }

  const totalViews = all.reduce((s, v) => s + v.views, 0)

  return (
    <FrontOfHouse>
      {/* ---- banner: the channel's own marquee ---- */}
      <div className="relative h-32 overflow-hidden sm:h-44 lg:h-52">
        <div className="absolute inset-0 opacity-45">
          <PosterPlate title="" seed={CHANNELS.indexOf(channel) * 7 + 3} lettering={false} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 to-transparent" />
      </div>

      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <div className="-mt-10 flex flex-wrap items-end gap-4 sm:-mt-12 sm:gap-6">
          <span className="rounded-full ring-4 ring-canvas">
            <Avatar name={channel.name} size={84} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-marquee text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-fg">
              {channel.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-300">
              <span className="font-mono">@{channel.handle}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{fmt(channel.subscribers)} following</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{published.length} videos</span>
            </p>
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-200">
              {channel.tagline}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-1">
            <SubscribeButton handle={channel.handle} />
          </div>
        </div>

        <div className="mt-7">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'videos', label: 'Videos', count: published.length },
              { id: 'about', label: 'About' },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 pb-16 sm:px-6 lg:px-8">
        {tab === 'videos' ? (
          loading || error ? (
            <div className="mt-10">
              <Resolve loading={loading} error={error} onRetry={refresh} what="Reading the channel">
                {null}
              </Resolve>
            </div>
          ) : published.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<Play className="size-6" />}
                title="Nothing published yet"
                body={`${channel.name} has not released anything to the programme.`}
              />
            </div>
          ) : (
            <>
              {/* The newest release gets the billing, the way a marquee works.
                  Only under the default sort — under any other the ordering is
                  the viewer's, and promoting one item would contradict it. */}
              {sort === 'recent' && featured && (
                <div className="mt-8 grid gap-6 border-b border-ink-800 pb-9 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
                  <Lightbox interactive>
                    <Link to={`/watch/${featured.id}`} className="block aspect-video">
                      <PosterPlate
                        title={featured.title}
                        creator={featured.creator}
                        runtime={featured.runtime}
                        seed={featured.seed}
                        category={featured.category}
                        thumbnailUrl={featured.thumbnailUrl}
                      />
                    </Link>
                  </Lightbox>
                  <div className="self-center">
                    <Letterboard tone="live">Latest release</Letterboard>
                    <Link to={`/watch/${featured.id}`}>
                      <h2 className="font-marquee mt-2.5 text-[clamp(1.5rem,3vw,2.1rem)] font-bold leading-[1.05] tracking-[-0.03em] text-fg hover:text-tone-violet-200">
                        {featured.title}
                      </h2>
                    </Link>
                    <p className="mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-ink-200">
                      {featured.synopsis}
                    </p>
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-300">
                      <span className="font-mono tabular-nums">{fmt(featured.views)} views</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono tabular-nums">{featured.runtime}</span>
                      <span aria-hidden>·</span>
                      <span>{featured.published}</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-4">
                <p className="letterboard text-ink-300">All videos</p>
                <div className="w-52">
                  <Select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    aria-label="Sort videos"
                  >
                    {(Object.keys(SORTS) as Sort[]).map((k) => (
                      <option key={k} value={k}>{SORTS[k].label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {sorted.map((v) => (
                  <Tile key={v.id} v={v} size="sm" />
                ))}
              </div>
            </>
          )
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="letterboard text-ink-300">About</p>
              <p className="mt-3 max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-200">
                {channel.about}
              </p>
            </div>
            <dl className="space-y-4 self-start border-l border-ink-800 pl-6">
              <div>
                <dt className="letterboard text-ink-300">Following</dt>
                <dd className="font-marquee mt-1 text-[24px] font-bold tabular-nums text-fg">
                  {fmt(channel.subscribers)}
                </dd>
              </div>
              <div>
                <dt className="letterboard text-ink-300">Total views</dt>
                <dd className="font-marquee mt-1 text-[24px] font-bold tabular-nums text-fg">
                  {fmt(totalViews)}
                </dd>
              </div>
              <div>
                <dt className="letterboard flex items-center gap-1.5 text-ink-300">
                  <CalendarDays className="size-3" /> Opened
                </dt>
                <dd className="mt-1 font-mono text-[13px] text-ink-150">{channel.created}</dd>
              </div>
              <div>
                <dt className="letterboard flex items-center gap-1.5 text-ink-300">
                  <MapPin className="size-3" /> Based in
                </dt>
                <dd className="mt-1 text-[13px] text-ink-150">{channel.location}</dd>
              </div>
              {isSubscribed(channel.handle) && (
                <p className="flex items-center gap-1.5 pt-1 text-[13px] text-tone-cyan-300">
                  <Users className="size-3.5" /> You follow this channel
                </p>
              )}
            </dl>
          </div>
        )}
      </div>
    </FrontOfHouse>
  )
}

/* ------------------------------------------------------- subscriptions feed */

export function Subscriptions() {
  const { subscriptions } = useLibrary()
  const nav = useNavigate()

  const { videos, loading, error, refresh } = useCatalogue()

  const channels = CHANNELS.filter((c) => subscriptions.includes(c.handle))
  const feed = useMemo(() => {
    const names = channels.map((c) => c.name)
    return videos.filter(
      (v) => names.includes(v.creator) && v.billing !== 'IN REVIEW' && v.billing !== 'PULLED',
    ).sort((a, b) => b.published.localeCompare(a.published))
  }, [videos, channels])

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-marquee text-[clamp(1.7rem,4vw,2.4rem)] font-extrabold leading-tight tracking-[-0.03em] text-fg">
          Following
        </h1>

        {loading || error ? (
          <div className="mt-10">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Reading your feed">
              {null}
            </Resolve>
          </div>
        ) : channels.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<Users className="size-6" />}
              title="You are not following anything yet"
              body="Follow a channel and its new releases collect here, newest first."
              action={<Button variant="primary" onClick={() => nav('/browse')}>Find something</Button>}
            />
          </div>
        ) : (
          <>
            {/* The channels themselves, so unfollowing does not mean hunting
                for the channel page first. */}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-4 border-b border-ink-800 pb-7">
              {channels.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5">
                  <Link to={`/channel/${c.handle}`} className="flex items-center gap-2.5 group">
                    <Avatar name={c.name} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-fg group-hover:text-tone-violet-200">
                        {c.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-ink-300">
                        @{c.handle}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <MarqueeRule className="mt-0" />

            <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {feed.map((v) => (
                <Tile key={v.id} v={v} size="sm" />
              ))}
            </div>
          </>
        )}
      </div>
    </FrontOfHouse>
  )
}
