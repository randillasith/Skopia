import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ListVideo, Plus, Play, Trash2, Lock, Link2, Globe, Check, Shuffle, X,
} from 'lucide-react'
import {
  Button, EmptyState, Modal, Field, Input, Select, useToast, Section,
} from '@/components/primitives'
import { PosterPlate, Lightbox } from '@/components/world'
import { FrontOfHouse } from '@/components/Shell'
import { fmt, seconds, clock, type Video } from '@/lib/data'
import { useCatalogue } from '@/lib/useCatalogue'
import { useLibrary, type Playlist, type PlaylistVisibility } from '@/lib/library'

const VISIBILITY: Record<PlaylistVisibility, { icon: typeof Lock; note: string }> = {
  Private: { icon: Lock, note: 'Only you can open it.' },
  Unlisted: { icon: Link2, note: 'Anyone with the link can open it.' },
  Public: { icon: Globe, note: 'Listed on your profile.' },
}

/**
 * Total runtime of a list, so "six hours" is a fact rather than a guess.
 *
 * The lookup is passed in rather than imported: the catalogue is loaded state
 * now, and a module-level function cannot read it.
 */
function totalRuntime(ids: string[], byId: (id: string) => Video | undefined) {
  const secs = ids.reduce((s, id) => s + seconds(byId(id)?.runtime ?? '0:00'), 0)
  return clock(secs)
}

/* ------------------------------------------------------------ save-to modal */

/**
 * Save to a playlist. Opened from the player and from any tile's overflow.
 * Creating a list from inside the dialog is deliberate: being sent away to a
 * manager and losing the video you were saving is the classic way to lose
 * somebody halfway through a two-step task.
 */
export function SaveToPlaylist({
  videoId,
  open,
  onClose,
}: {
  videoId: string
  open: boolean
  onClose: () => void
}) {
  const { playlists, toggleInPlaylist, createPlaylist, watchLater, toggleWatchLater } = useLibrary()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<PlaylistVisibility>('Private')

  const submit = () => {
    if (!name.trim()) return
    const pl = createPlaylist(name.trim(), visibility)
    toggleInPlaylist(pl.id, videoId)
    toast({ title: `Saved to ${pl.name}`, tone: 'ok' })
    setName('')
    setCreating(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Save to">
      <ul className="space-y-1">
        <li>
          <button
            onClick={() => {
              const added = toggleWatchLater(videoId)
              toast({ title: added ? 'Saved to Watch later' : 'Removed from Watch later' })
            }}
            className="flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors hover:bg-ink-800"
          >
            <span
              className={
                watchLater.includes(videoId)
                  ? 'flex size-4 items-center justify-center rounded-xs bg-violet-500 text-white'
                  : 'size-4 rounded-xs border border-ink-500'
              }
            >
              {watchLater.includes(videoId) && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className="flex-1 text-[14px] text-ink-100">Watch later</span>
            <Lock className="size-3.5 text-ink-300" />
          </button>
        </li>
        {playlists.map((p) => {
          const has = p.videoIds.includes(videoId)
          const Icon = VISIBILITY[p.visibility].icon
          return (
            <li key={p.id}>
              <button
                onClick={() => {
                  const added = toggleInPlaylist(p.id, videoId)
                  toast({ title: added ? `Saved to ${p.name}` : `Removed from ${p.name}` })
                }}
                className="flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors hover:bg-ink-800"
              >
                <span
                  className={
                    has
                      ? 'flex size-4 items-center justify-center rounded-xs bg-violet-500 text-white'
                      : 'size-4 rounded-xs border border-ink-500'
                  }
                >
                  {has && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex-1 truncate text-[14px] text-ink-100">{p.name}</span>
                <Icon className="size-3.5 text-ink-300" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 border-t border-ink-700 pt-3">
        {creating ? (
          <div className="space-y-3">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What is this list for?"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </Field>
            <Field label="Visibility" hint={VISIBILITY[visibility].note}>
              <Select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as PlaylistVisibility)}
              >
                {(Object.keys(VISIBILITY) as PlaylistVisibility[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={submit} disabled={!name.trim()}>
                Create
              </Button>
              <Button size="sm" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New playlist
          </Button>
        )}
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- the list */

function PlaylistCard({ p }: { p: Playlist }) {
  const { byId } = useCatalogue()
  const cover = byId(p.videoIds[0] ?? '')
  const Icon = VISIBILITY[p.visibility].icon
  return (
    <article className="group min-w-0">
      <Link to={`/playlist/${p.id}`} className="block">
        <Lightbox interactive>
          <span className="relative block aspect-video">
            {cover ? (
              <PosterPlate title={cover.title} seed={cover.seed} category={cover.category} compact lettering={false} />
            ) : (
              <span className="block size-full bg-ink-850" />
            )}
            {/* The stacked edge reads as "more behind this one" without a count
                nobody would parse at thumbnail size. */}
            <span className="absolute inset-y-0 right-0 flex w-[38%] flex-col items-center justify-center gap-1 bg-ink-950/78 backdrop-blur-[2px]">
              <ListVideo className="size-4 text-ink-200" />
              <span className="font-mono text-[12px] tabular-nums text-fg">
                {p.videoIds.length}
              </span>
            </span>
          </span>
        </Lightbox>
      </Link>
      <div className="mt-2.5">
        <Link to={`/playlist/${p.id}`}>
          <h3 className="font-marquee truncate text-[15px] font-bold tracking-tight text-fg transition-colors group-hover:text-tone-violet-200">
            {p.name}
          </h3>
        </Link>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-300">
          <Icon className="size-3" />
          {p.visibility}
          <span aria-hidden>·</span>
          <span className="font-mono tabular-nums">{totalRuntime(p.videoIds, byId)}</span>
        </p>
      </div>
    </article>
  )
}

export function Playlists() {
  const { playlists, watchLater, createPlaylist } = useLibrary()
  const { byId } = useCatalogue()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<PlaylistVisibility>('Private')

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-marquee text-[clamp(1.7rem,4vw,2.4rem)] font-extrabold leading-tight tracking-[-0.03em] text-fg">
            Playlists
          </h1>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            New playlist
          </Button>
        </div>

        <Section title="Saved" className="mt-8">
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {/* Watch later is a playlist in every way that matters, so it sits
                with them rather than hiding in the navigation. */}
            <article className="group min-w-0">
              <Link to="/watchlist" className="block">
                <Lightbox interactive>
                  <span className="relative block aspect-video bg-ink-850">
                    {watchLater[0] && byId(watchLater[0]) && (
                      <PosterPlate
                        title={byId(watchLater[0])!.title}
                        seed={byId(watchLater[0])!.seed}
                        category={byId(watchLater[0])!.category}
                        compact
                        lettering={false}
                      />
                    )}
                    <span className="absolute inset-y-0 right-0 flex w-[38%] flex-col items-center justify-center gap-1 bg-ink-950/78 backdrop-blur-[2px]">
                      <ListVideo className="size-4 text-ink-200" />
                      <span className="font-mono text-[12px] tabular-nums text-fg">
                        {watchLater.length}
                      </span>
                    </span>
                  </span>
                </Lightbox>
              </Link>
              <div className="mt-2.5">
                <h3 className="font-marquee truncate text-[15px] font-bold text-fg group-hover:text-tone-violet-200">
                  Watch later
                </h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-300">
                  <Lock className="size-3" /> Private
                </p>
              </div>
            </article>

            {playlists.map((p) => <PlaylistCard key={p.id} p={p} />)}
          </div>
        </Section>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New playlist"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                createPlaylist(name.trim(), visibility)
                toast({ title: `${name.trim()} created`, tone: 'ok' })
                setName('')
                setOpen(false)
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="What is this list for?" />
          </Field>
          <Field label="Visibility" hint={VISIBILITY[visibility].note}>
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value as PlaylistVisibility)}>
              {(Object.keys(VISIBILITY) as PlaylistVisibility[]).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </FrontOfHouse>
  )
}

/* -------------------------------------------------------------- one list */

export function PlaylistDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { playlists, toggleInPlaylist, deletePlaylist, renamePlaylist } = useLibrary()
  const { byId } = useCatalogue()
  const [confirm, setConfirm] = useState(false)
  const p = playlists.find((x) => x.id === id)

  if (!p) {
    return (
      <FrontOfHouse>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <EmptyState
            title="No such playlist"
            body="It may have been deleted."
            action={<Button onClick={() => nav('/playlists')}>All playlists</Button>}
          />
        </div>
      </FrontOfHouse>
    )
  }

  const items = p.videoIds.map((vid) => byId(vid)).filter(Boolean) as Video[]
  const Icon = VISIBILITY[p.visibility].icon

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[330px_1fr] lg:gap-12">
          {/* ---- the list itself, kept beside its contents ---- */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Lightbox>
              <span className="block aspect-video">
                {items[0] ? (
                  <PosterPlate title={items[0].title} seed={items[0].seed} category={items[0].category} compact lettering={false} />
                ) : (
                  <span className="block size-full bg-ink-850" />
                )}
              </span>
            </Lightbox>
            <h1 className="font-marquee mt-4 text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-fg">
              {p.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-300">
              <Icon className="size-3.5" />
              {p.visibility}
              <span aria-hidden>·</span>
              <span className="tabular-nums">{items.length} videos</span>
              <span aria-hidden>·</span>
              <span className="font-mono tabular-nums">{totalRuntime(p.videoIds, byId)}</span>
            </p>
            {items.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon={<Play className="size-4 fill-current" />}
                  onClick={() => nav(`/watch/${items[0].id}`)}
                >
                  Play all
                </Button>
                <Button
                  icon={<Shuffle className="size-4" />}
                  onClick={() => nav(`/watch/${items[Math.floor(Math.random() * items.length)].id}`)}
                >
                  Shuffle
                </Button>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  const next = window.prompt('Rename this playlist', p.name)
                  if (next?.trim()) {
                    renamePlaylist(p.id, next.trim())
                    toast({ title: 'Playlist renamed' })
                  }
                }}
              >
                Rename
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            </div>
          </aside>

          {/* ---- contents, numbered, removable in place ---- */}
          <div className="min-w-0">
            {items.length === 0 ? (
              <EmptyState
                icon={<ListVideo className="size-6" />}
                title="Nothing in this list yet"
                body="Use Save on any video to add it here."
                action={<Button onClick={() => nav('/browse')}>Find something</Button>}
              />
            ) : (
              <ol className="divide-y divide-ink-800">
                {items.map((v, i) => (
                  <li key={v.id} className="group flex items-center gap-3 py-3">
                    <span className="w-6 shrink-0 text-center font-mono text-[12px] tabular-nums text-ink-300">
                      {i + 1}
                    </span>
                    <Link to={`/watch/${v.id}`} className="w-32 shrink-0 overflow-hidden rounded-xs sm:w-40">
                      <span className="block aspect-video">
                        <PosterPlate title={v.title} seed={v.seed} category={v.category} compact lettering={false} />
                      </span>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/watch/${v.id}`}>
                        <p className="font-marquee truncate text-[15px] font-bold text-fg hover:text-tone-violet-200">
                          {v.title}
                        </p>
                      </Link>
                      <p className="mt-0.5 truncate text-[12px] text-ink-300">
                        {v.creator} · <span className="font-mono tabular-nums">{fmt(v.views)} views</span>
                      </p>
                    </div>
                    <span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-ink-300 sm:block">
                      {v.runtime}
                    </span>
                    <button
                      aria-label={`Remove ${v.title} from ${p.name}`}
                      onClick={() => {
                        toggleInPlaylist(p.id, v.id)
                        toast({ title: `Removed from ${p.name}` })
                      }}
                      className="shrink-0 rounded-sm p-2 text-ink-300 opacity-0 transition-opacity hover:bg-ink-800 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${p.name}?`}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Keep it</Button>
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                deletePlaylist(p.id)
                toast({ title: `${p.name} deleted`, tone: 'bad' })
                nav('/playlists')
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          The list goes; the videos stay in the programme. This cannot be undone.
        </p>
      </Modal>
    </FrontOfHouse>
  )
}
