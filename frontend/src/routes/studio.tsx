import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Upload, Plus, AlertTriangle, Check, Trash2, Archive, Eye, ThumbsUp,
  MessageSquare, TrendingUp, FileVideo, Captions, ArrowLeft, ArrowRight, ShieldHalf,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Textarea, Table, Th, Td, Tr, EmptyState,
  Modal, Placeholder, useToast, Checkbox, Section, Avatar,
} from '@/components/primitives'
import { PosterPlate, Letterboard, BillingBoard, Stations, Lightbox } from '@/components/world'
import { BackOfHouse, FrontOfHouse, useSession } from '@/components/Shell'
import { GENRES, fmt, UNDECIDED } from '@/lib/data'
import { useCatalogue, useMyVideos, useVideo } from '@/lib/useCatalogue'
import { studio, videoIdOf } from '@/lib/catalogue'
import { actorId as actorIdOf } from '@/lib/session'
import { ApiError } from '@/lib/api'
import { Resolve } from '@/components/Loading'
import { ACCOUNTS, CHANNELS, accountById, ownedChannel } from '@/lib/session'

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * The studio only ever shows the signed-in account's own channel. Scoping it to
 * a hard-coded list of creator names was left over from the flat role model, and
 * it meant every creator saw the same two studios' videos as though they were
 * their own.
 */
/* The shelf comes from the server, scoped to the caller — see lib/useCatalogue. */

/* ========================================================= video library */

export function StudioLibrary() {
  const nav = useNavigate()
  const { viewer } = useSession()
  const actor = actorIdOf(viewer)
  const { videos: MINE, loading, error, refresh } = useMyVideos()
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const target = confirm ? MINE.find((v) => v.id === confirm) : undefined

  /** Archiving keeps the record and hides it; deleting does not come back. */
  const act = async (what: 'archive' | 'delete') => {
    if (!target) return
    const numeric = videoIdOf(target.id)
    if (numeric == null) return
    setBusy(true)
    try {
      if (what === 'archive') {
        await studio.update(numeric, { status: 'ARCHIVED' }, actor)
        toast({ title: 'Archived — hidden from viewers, record kept' })
      } else {
        await studio.remove(numeric, actor)
        toast({ title: 'Video deleted', tone: 'bad' })
      }
      setConfirm(null)
      refresh()
    } catch (cause) {
      toast({
        title: cause instanceof ApiError ? cause.message : 'That did not go through.',
        tone: 'bad',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <BackOfHouse
      title="Video library"
      actions={
        <Button variant="primary" size="sm" icon={<Plus className="size-4" />}
          onClick={() => nav('/studio/upload')}>
          Upload
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Published', MINE.filter((v) => v.billing === 'NOW SHOWING' || v.billing === 'HELD OVER').length],
          ['In review', MINE.filter((v) => v.billing === 'IN REVIEW').length],
          ['Total views', fmt(MINE.reduce((s, v) => s + v.views, 0))],
          ['Comments', fmt(MINE.reduce((s, v) => s + v.comments, 0))],
        ].map(([label, value]) => (
          <div key={label as string} className="border-l border-ink-700 pl-3">
            <p className="letterboard text-ink-300">{label}</p>
            <p className="font-marquee mt-1 text-[26px] font-bold tabular-nums text-fg">{value}</p>
          </div>
        ))}
      </div>

      {loading || error ? (
        <div className="mt-8">
          <Resolve loading={loading} error={error} onRetry={refresh} what="Reading your library">
            {null}
          </Resolve>
        </div>
      ) : MINE.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing published yet"
            body="Upload a video and it appears here with its billing, its views and its comments."
            action={<Button variant="primary" onClick={() => nav('/studio/upload')}>Upload a video</Button>}
          />
        </div>
      ) : (
      <div className="mt-8 rounded-lg border border-ink-700 bg-ink-850">
        <Table labels={["Title", "Billing", "Category", "Published", "Views", "Likes", "Captions", ""]}>
          <thead>
            <tr>
              <Th>Title</Th><Th>Billing</Th><Th>Category</Th><Th>Published</Th>
              <Th numeric>Views</Th><Th numeric>Likes</Th><Th>Captions</Th><Th />
            </tr>
          </thead>
          <tbody>
            {MINE.map((v) => (
              <Tr key={v.id}>
                <Td>
                  <Link to={`/studio/video/${v.id}`} className="flex items-center gap-3 group">
                    <span className="w-16 shrink-0 overflow-hidden rounded-xs">
                      <span className="block aspect-video">
                        <PosterPlate title={v.title} seed={v.seed} category={v.category} compact lettering={false} />
                      </span>
                    </span>
                    <span className="font-marquee font-bold text-fg group-hover:text-tone-violet-200">
                      {v.title}
                    </span>
                  </Link>
                </Td>
                <Td><BillingBoard billing={v.billing} /></Td>
                <Td className="text-ink-300">{v.category}</Td>
                <Td><span className="font-mono tabular-nums text-ink-300">{v.published}</span></Td>
                <Td numeric>{v.views.toLocaleString()}</Td>
                <Td numeric>{v.likes.toLocaleString()}</Td>
                <Td>
                  {v.captions.length ? (
                    <Letterboard tone="ok">{v.captions[0]}</Letterboard>
                  ) : (
                    <Letterboard tone="bad">None</Letterboard>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="quiet" onClick={() => nav(`/studio/video/${v.id}`)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="quiet" onClick={() => setConfirm(v.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Delete “${target?.title}”?`}
        width="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(null)}>Keep it</Button>
            <Button variant="secondary" icon={<Archive className="size-4" />} loading={busy}
              onClick={() => act('archive')}>
              Archive instead
            </Button>
            <Button variant="danger" loading={busy} onClick={() => act('delete')}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          Deleting removes the video and its comments for good. Archiving hides it from viewers but
          keeps the record, its metrics and its history — that is usually what you want.
        </p>
      </Modal>
    </BackOfHouse>
  )
}

/* =============================================================== upload */

const UPLOAD_STEPS = ['File', 'Details', 'Captions', 'Review', 'Published']

export function StudioUpload() {
  const nav = useNavigate()
  const toast = useToast()
  const { viewer } = useSession()
  const actor = actorIdOf(viewer)
  const { categories, videos, refresh } = useCatalogue()
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [genre, setGenre] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [publishing, setPublishing] = useState(false)

  // The chosen file and what the browser can tell us about it. The duration is
  // read from the file itself rather than asked for, because the person
  // uploading should not have to know it and would often be wrong.
  const [file, setFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const picker = useRef<HTMLInputElement>(null)
  // The catalogue will not take a title without a poster, so one is asked for
  // here rather than at the last station where refusing is most expensive.
  const [poster, setPoster] = useState<File | null>(null)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const posterPicker = useRef<HTMLInputElement>(null)

  /** UC-FR1-03 extension 5b — warn on a possible duplicate before confirmation. */
  const duplicate = videos.find(
    (v) => title.trim().length > 3 && v.title.toLowerCase().startsWith(title.trim().toLowerCase().slice(0, 6)),
  )

  const choose = (chosen: File) => {
    setFile(chosen)
    // Nothing is sent yet: the file is held until the record it belongs to is
    // complete, so a cancelled upload leaves no orphan on the server.
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      setDuration(Number.isFinite(probe.duration) ? probe.duration : 0)
      URL.revokeObjectURL(probe.src)
    }
    probe.src = URL.createObjectURL(chosen)
    if (!title.trim()) setTitle(chosen.name.replace(/\.[^.]+$/, ''))
    setStep(1)
  }

  const publish = async (status: 'PUBLISHED' | 'DRAFT') => {
    setPublishing(true)
    try {
      await studio.publish(
        {
          title: title.trim(),
          description: synopsis.trim(),
          categoryId: categories.find((c) => c.name === category)?.id ?? null,
          accessType: 'FREE',
          status,
          durationSeconds: duration,
          videoFile: file,
          thumbnailFile: poster,
        },
        actor,
      )
      refresh()
      if (status === 'PUBLISHED') {
        setStep(4)
        toast({ title: 'Published — now showing', tone: 'ok' })
      } else {
        toast({ title: 'Saved as a draft' })
        nav('/studio')
      }
    } catch (cause) {
      toast({
        title: cause instanceof ApiError ? cause.message : 'The upload did not go through.',
        tone: 'bad',
      })
    } finally {
      setPublishing(false)
    }
  }

  const validateDetails = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'A title is required before this record can be saved.'
    if (!category) e.category = 'Choose the category viewers will find this under.'
    // Genre is not required, because the catalogue has nowhere to store it: a
    // field that cannot be saved must not be able to block a publish.
    if (synopsis.trim().length < 20) e.synopsis = 'Write at least a sentence describing the video.'
    if (!poster) e.poster = 'Choose a thumbnail — the catalogue will not take a title without one.'
    setErrors(e)
    if (Object.keys(e).length === 0) setStep(2)
  }

  return (
    <BackOfHouse title="Upload a video">
      <div className="mx-auto max-w-3xl">
        <Stations steps={UPLOAD_STEPS} active={step} pointOfNoReturn={4} />
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-300">
          <AlertTriangle className="size-3.5 text-tone-warning-400" />
          Nothing is visible to viewers until you publish at the last station.
        </p>

        <div className="mt-8">
          {/* ---- 0 · file ---- */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
              <input
                ref={picker}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => {
                  const chosen = e.target.files?.[0]
                  if (chosen) choose(chosen)
                }}
              />
              <button
                onClick={() => picker.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const dropped = e.dataTransfer.files?.[0]
                  if (dropped) choose(dropped)
                }}
                className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-ink-600 bg-ink-850/50 px-6 py-16 text-center transition-colors hover:border-violet-500/60 hover:bg-violet-500/4"
              >
                <FileVideo className="size-9 text-ink-300" />
                <p className="font-marquee mt-4 text-[19px] font-bold text-fg">
                  Choose a video file
                </p>
                <p className="mt-1.5 text-[14px] text-ink-300">or drag it here</p>
                <p className="mt-4 text-[12.5px] text-ink-300">
                  A video file is required. It is held here and sent when you publish, so leaving
                  now uploads nothing.
                </p>
              </button>

            </motion.div>
          )}

          {/* ---- 1 · details ---- */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="space-y-5">
              <Field label="Title" required error={errors.title}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The title viewers will see" invalid={!!errors.title} />
              </Field>

              {duplicate && (
                <div className="flex items-start gap-2.5 rounded-sm border border-warning-500/35 bg-warning-500/8 px-4 py-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-tone-warning-400" />
                  <div className="text-[13.5px] leading-relaxed">
                    <p className="font-medium text-tone-warning-400">This may be a duplicate</p>
                    <p className="mt-0.5 text-ink-300">
                      “{duplicate.title}” by {duplicate.creator} is already in the catalogue. You can
                      continue, but check you are not re-uploading the same video.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Category" required error={errors.category}>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Choose one</option>
                    {categories.map((c) => <option key={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Genre" hint="Not stored against a title yet." error={errors.genre}>
                  <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
                    <option value="">Choose one</option>
                    {GENRES.map((g) => <option key={g}>{g}</option>)}
                  </Select>
                </Field>
              </div>

              <Field label="Synopsis" required hint={`${synopsis.length}/500`} error={errors.synopsis}>
                <Textarea value={synopsis} maxLength={500} onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="What is this video, in a sentence or two?" />
              </Field>

              <Field label="Thumbnail" required hint="16:9 recommended" error={errors.poster}>
                <div className="flex items-center gap-4">
                  <Lightbox className="w-40">
                    <span className="block aspect-video">
                      {posterUrl ? (
                        <img src={posterUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <PosterPlate title={title || 'Untitled'} seed={title.length + 2} compact />
                      )}
                    </span>
                  </Lightbox>
                  <input
                    ref={posterPicker}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const chosen = e.target.files?.[0]
                      if (!chosen) return
                      setPoster(chosen)
                      setPosterUrl((old) => {
                        if (old) URL.revokeObjectURL(old)
                        return URL.createObjectURL(chosen)
                      })
                    }}
                  />
                  <Button
                    size="sm"
                    icon={<Upload className="size-4" />}
                    onClick={() => posterPicker.current?.click()}
                  >
                    {poster ? 'Replace thumbnail' : 'Choose a thumbnail'}
                  </Button>
                </div>
              </Field>

              <div className="flex justify-between pt-2">
                <Button variant="quiet" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(0)}>Back</Button>
                <Button variant="primary" icon={<ArrowRight className="size-4" />} onClick={validateDetails}>
                  Continue to captions
                </Button>
              </div>
            </motion.div>
          )}

          {/* ---- 2 · captions ---- */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="space-y-5">
              <div className="rounded-lg border border-ink-700 bg-ink-850 p-5">
                <div className="flex items-center gap-3">
                  <Captions className="size-5 text-tone-cyan-400" />
                  <div>
                    <p className="text-[15px] font-medium text-fg">Caption tracks</p>
                    <p className="text-[13px] text-ink-300">
                      Platform announcement: new uploads must carry at least one track.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-sm border border-ink-700 bg-ink-950 px-3.5 py-2.5">
                  <span className="text-[14px] text-ink-100">English — placeholder-en.vtt</span>
                  <Letterboard tone="ok">Attached</Letterboard>
                </div>
                <Button size="sm" className="mt-3" icon={<Plus className="size-4" />}>
                  Add another language
                </Button>
                <p className="mt-3 text-[12.5px] text-ink-300">
                  Which subtitle languages ship first is not yet decided.
                </p>
              </div>

              <div className="rounded-lg border border-ink-700 bg-ink-850 p-5">
                <p className="text-[15px] font-medium text-fg">Playback settings</p>
                <div className="mt-3 space-y-3">
                  <Checkbox checked onChange={() => {}} label="Allow comments" />
                  <Checkbox checked onChange={() => {}} label="Allow this video to be shared" />
                  <Checkbox checked={false} onChange={() => {}} label="Premium — requires an active pass" />
                </div>
                <p className="mt-3 text-[12.5px] text-ink-300">
                  Initial playback quality levels are not yet specified: <Placeholder>{UNDECIDED}</Placeholder>
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="quiet" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" icon={<ArrowRight className="size-4" />} onClick={() => setStep(3)}>
                  Review before publishing
                </Button>
              </div>
            </motion.div>
          )}

          {/* ---- 3 · review ---- */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
              <div className="rounded-lg border border-ink-700 bg-ink-850 p-6">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <Lightbox className="w-full shrink-0 sm:w-56">
                    <span className="block aspect-video">
                      <PosterPlate title={title} seed={title.length + 2} compact />
                    </span>
                  </Lightbox>
                  <div className="min-w-0">
                    <h2 className="font-marquee text-[22px] font-bold text-fg">{title}</h2>
                    <p className="mt-1 text-[13px] text-ink-300">{category} · {genre}</p>
                    <p className="mt-3 text-[14px] leading-relaxed text-ink-200">{synopsis}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Letterboard tone="ok">CC English</Letterboard>
                      <Letterboard>Comments on</Letterboard>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2.5 rounded-sm border border-danger-500/35 bg-danger-500/8 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-tone-danger-400" />
                <p className="text-[13.5px] leading-relaxed text-ink-200">
                  Publishing makes this visible to viewers and starts collecting views and comments.
                  You can archive it afterwards, but the earlier stations close.
                </p>
              </div>

              <div className="mt-5 flex justify-between">
                <Button variant="quiet" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(2)}>Back</Button>
                <div className="flex gap-2">
                  <Button loading={publishing} onClick={() => publish('DRAFT')}>
                    Save as draft
                  </Button>
                  <Button variant="primary" loading={publishing} onClick={() => publish('PUBLISHED')}>
                    Publish now
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---- 4 · published ---- */}
          {step === 4 && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: EASE }}
              className="rounded-lg border border-success-500/35 bg-success-500/6 p-8 text-center">
              <Check className="mx-auto size-9 text-tone-success-400" />
              <h2 className="font-marquee mt-4 text-[24px] font-bold text-fg">{title} is now showing</h2>
              <p className="mx-auto mt-2 max-w-[48ch] text-[14px] leading-relaxed text-ink-300">
                Viewers can find it in {category}. Metrics start from now, and you can edit its
                details at any time.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <Button variant="primary" onClick={() => nav('/studio')}>Back to library</Button>
                <Button onClick={() => nav('/studio/upload')}>Upload another</Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </BackOfHouse>
  )
}

/* ============================================================ edit video */

export function StudioEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const { video: v, loading, error, reload } = useVideo(id)
  const { categories, refresh } = useCatalogue()
  const { viewer } = useSession()
  const actor = actorIdOf(viewer)
  const toast = useToast()

  // The form is held here rather than read off the DOM on submit, so what is
  // sent is what is on screen and an unchanged field is not sent as a change.
  const [form, setForm] = useState({ title: '', category: '', synopsis: '', premium: false })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (v) setForm({ title: v.title, category: v.category, synopsis: v.synopsis, premium: v.premium })
  }, [v?.id])

  const numeric = v ? videoIdOf(v.id) : null

  const save = async () => {
    if (numeric == null) return
    setBusy(true)
    try {
      await studio.update(
        numeric,
        {
          title: form.title.trim(),
          description: form.synopsis.trim(),
          categoryId: categories.find((c) => c.name === form.category)?.id ?? null,
          accessType: form.premium ? 'PREMIUM' : 'FREE',
        },
        actor,
      )
      refresh()
      reload()
      toast({ title: 'Changes saved', tone: 'ok' })
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'Could not save that.', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  const takeDown = async (what: 'archive' | 'delete') => {
    if (numeric == null) return
    setBusy(true)
    try {
      if (what === 'archive') {
        await studio.update(numeric, { status: 'ARCHIVED' }, actor)
        toast({ title: 'Archived' })
        reload()
      } else {
        await studio.remove(numeric, actor)
        toast({ title: 'Deleted', tone: 'bad' })
        nav('/studio')
      }
      refresh()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'That did not go through.', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  if (loading || error || !v) {
    return (
      <BackOfHouse title="Video">
        <Resolve loading={loading} error={error} onRetry={reload} what="Opening the record">
          <EmptyState title="No such video" body="That record does not exist, or it has been deleted."
            action={<Button onClick={() => nav('/studio')}>Back to library</Button>} />
        </Resolve>
      </BackOfHouse>
    )
  }

  return (
    <BackOfHouse
      title={v.title}
      actions={
        <>
          <Button size="sm" variant="quiet" onClick={() => nav(`/watch/${v.id}`)}>
            View as a viewer
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <Field label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" required>
              <Select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {categories.map((c) => <option key={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            {/* Genre is not stored against a title, so this cannot be saved. It
                is shown disabled rather than removed while the decision is open. */}
            <Field label="Genre" hint="Not recorded against a title yet.">
              <Select disabled defaultValue={v.genre}>{GENRES.map((g) => <option key={g}>{g}</option>)}</Select>
            </Field>
          </div>
          <Field label="Synopsis" required>
            <Textarea value={form.synopsis} onChange={(e) => setForm((f) => ({ ...f, synopsis: e.target.value }))} />
          </Field>

          <div className="rounded-lg border border-ink-700 bg-ink-850 p-5">
            <p className="text-[15px] font-medium text-fg">Playback settings</p>
            <div className="mt-3 space-y-3">
              <Checkbox checked onChange={() => {}} label="Allow comments" />
              <Checkbox checked onChange={() => {}} label="Allow sharing" />
              <Checkbox
                checked={form.premium}
                onChange={(premium) => setForm((f) => ({ ...f, premium }))}
                label="Premium — requires an active pass"
              />
            </div>
          </div>

          <div className="rounded-lg border border-danger-500/30 bg-danger-500/6 p-5">
            <h2 className="font-marquee text-[16px] font-bold text-tone-danger-400">Take this down</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-300">
              Archiving hides it from viewers and keeps the record. Deleting removes it and its
              comments for good.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" icon={<Archive className="size-4" />} loading={busy}
                onClick={() => takeDown('archive')}>Archive</Button>
              <Button variant="danger" icon={<Trash2 className="size-4" />} loading={busy}
                onClick={() => takeDown('delete')}>Delete</Button>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div>
            <p className="letterboard mb-2 text-ink-300">Thumbnail</p>
            <Lightbox interactive>
              <span className="block aspect-video"><PosterPlate title={v.title} seed={v.seed} category={v.category} compact /></span>
            </Lightbox>
            <Button size="sm" className="mt-2.5 w-full" icon={<Upload className="size-4" />}>Replace</Button>
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
            <p className="letterboard mb-3 text-ink-300">Performance</p>
            <dl className="space-y-2.5 text-[13px]">
              {[
                [<Eye key="e" className="size-3.5" />, 'Views', v.views.toLocaleString()],
                [<ThumbsUp key="l" className="size-3.5" />, 'Likes', v.likes.toLocaleString()],
                [<MessageSquare key="c" className="size-3.5" />, 'Comments', v.comments.toLocaleString()],
              ].map(([icon, label, value]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-ink-300">{icon}{label}</dt>
                  <dd className="font-mono tabular-nums text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
            <p className="letterboard mb-2 text-ink-300">Billing</p>
            <BillingBoard billing={v.billing} />
            <p className="mt-2 font-mono text-[11px] text-ink-300">Published {v.published}</p>
          </div>
        </aside>
      </div>
    </BackOfHouse>
  )
}

/* ============================================================== analytics */

export function StudioAnalytics() {
  const { videos: MINE, loading, error, refresh } = useMyVideos()
  const total = MINE.reduce((s, v) => s + v.views, 0)
  // Math.max of nothing is -Infinity, which would divide every bar to NaN.
  const max = MINE.length ? Math.max(...MINE.map((v) => v.views)) : 0

  if (loading || error || MINE.length === 0) {
    return (
      <BackOfHouse title="Analytics">
        <Resolve loading={loading} error={error} onRetry={refresh} what="Reading your figures">
          <EmptyState
            title="Nothing to measure yet"
            body="Analytics appear once you have published something and it has been watched."
          />
        </Resolve>
      </BackOfHouse>
    )
  }

  return (
    <BackOfHouse title="Analytics">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Total views', total.toLocaleString()],
          ['Total likes', MINE.reduce((s, v) => s + v.likes, 0).toLocaleString()],
          ['Comments', MINE.reduce((s, v) => s + v.comments, 0).toLocaleString()],
          ['Titles', String(MINE.length)],
        ].map(([l, v]) => (
          <div key={l} className="border-l border-ink-700 pl-3">
            <p className="letterboard text-ink-300">{l}</p>
            <p className="font-marquee mt-1 text-[28px] font-bold tabular-nums text-fg">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-9">
        <Section title="Views by title">
          <ul className="space-y-3.5">
            {[...MINE].sort((a, b) => b.views - a.views).map((v) => (
              <li key={v.id} className="grid grid-cols-[1fr_auto] items-center gap-4">
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link to={`/studio/video/${v.id}`} className="font-marquee truncate text-[15px] font-bold text-fg hover:text-tone-violet-200">
                      {v.title}
                    </Link>
                    <span className="font-mono text-[12px] tabular-nums text-ink-300">
                      {v.views.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <div
                      style={{ width: `${(v.views / max) * 100}%` }}
                      className="h-full rounded-full bg-violet-500"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <p className="mt-8 flex items-center gap-2 text-[13px] text-ink-300">
        <TrendingUp className="size-4" />
        Figures are placeholders. Which metrics ship, and how they are calculated, is an open
        decision in the documentation.
      </p>
    </BackOfHouse>
  )
}

/* ====================================================== create a channel */

/**
 * Self-service. A registered account becomes a creator by naming a channel —
 * there is no approval step and no administrator in the path. That is the whole
 * point of the screen, so it says so rather than implying it by absence.
 */
export function CreateChannel() {
  const nav = useNavigate()
  const toast = useToast()
  const { viewer } = useSession()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const slug = handle || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const taken = CHANNELS.some((c) => c.handle === slug)
  const tooShort = slug.length > 0 && slug.length < 3
  const error = taken ? 'That handle is already in use.' : tooShort ? 'Handles are at least three characters.' : ''
  const ready = name.trim().length > 1 && slug.length >= 3 && !taken

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!ready) return
    setBusy(true)
    window.setTimeout(() => {
      toast({ title: `${name} is yours. You can publish straight away.`, tone: 'ok' })
      nav('/studio')
    }, 650)
  }

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="letterboard text-ink-300">Creator</p>
        <h1 className="font-marquee mt-2 text-[clamp(1.9rem,5vw,2.8rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-fg">
          Open a channel
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-200">
          Everything you publish belongs to a channel. Nobody approves this — the channel exists
          the moment you name it, and you can upload immediately.
        </p>

        <form onSubmit={submit} className="mt-9 space-y-5">
          <Field label="Channel name" hint="What viewers see under every video.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meridian Films"
              autoFocus
            />
          </Field>

          <Field
            label="Handle"
            hint="The channel's address. Letters, numbers and hyphens."
            error={touched ? error : ''}
          >
            <div className="flex items-stretch">
              <span className="flex items-center rounded-l-sm border border-r-0 border-ink-600 bg-ink-900 px-3 font-mono text-[13px] text-ink-300">
                skopia.lk/@
              </span>
              <Input
                className="rounded-l-none"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                onBlur={() => setTouched(true)}
                placeholder={slug || 'meridian'}
              />
            </div>
          </Field>

          <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
            <p className="letterboard text-ink-300">What opening a channel gives you</p>
            <ul className="mt-2.5 space-y-1.5 text-[14px] text-ink-200">
              <li>· Publish, edit and withdraw your own videos</li>
              <li>· Appoint moderators for this channel, and remove them</li>
              <li>· See how your own videos perform</li>
            </ul>
            <p className="mt-3 border-t border-ink-700 pt-3 text-[13px] leading-relaxed text-ink-300">
              It gives you nothing beyond your own channel. Staff work — advertising, the complaint
              queue, platform settings — stays with the roles an administrator grants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!ready}>
              Create {name.trim() ? name.trim() : 'channel'}
            </Button>
            <Button type="button" size="lg" onClick={() => nav('/browse')}>
              Not now
            </Button>
          </div>
          <p className="text-[13px] text-ink-300">
            Opening as <span className="text-ink-150">{viewer?.name}</span> · @{viewer?.handle}
          </p>
        </form>
      </div>
    </FrontOfHouse>
  )
}

/* ======================================================= channel moderators */

/**
 * A channel owner grants and revokes moderation on their own channel. An
 * administrator cannot do this for them, and a grant made here reaches nothing
 * beyond this channel — both facts are stated on the screen because getting them
 * wrong is how a permission model quietly becomes a lie.
 */
export function ChannelModerators() {
  const { viewer } = useSession()
  const channel = ownedChannel(viewer)!
  const toast = useToast()
  const [mods, setMods] = useState<string[]>(channel.moderators)
  const [query, setQuery] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)

  const candidates = ACCOUNTS.filter(
    (a) =>
      a.id !== viewer?.id &&
      !mods.includes(a.id) &&
      query.length > 1 &&
      (a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.handle.toLowerCase().includes(query.toLowerCase())),
  ).slice(0, 4)

  const grant = (a: (typeof ACCOUNTS)[number]) => {
    setMods((m) => [...m, a.id])
    setQuery('')
    toast({ title: `${a.name} can now moderate comments on ${channel.name}.`, tone: 'ok' })
  }

  const revoke = (id: string) => {
    const a = accountById(id)
    setMods((m) => m.filter((x) => x !== id))
    setConfirm(null)
    toast({ title: `${a?.name ?? 'That account'} no longer moderates ${channel.name}.` })
  }

  const target = confirm ? accountById(confirm) : null

  return (
    <BackOfHouse title="Moderators">
      <p className="max-w-[70ch] text-[14px] leading-relaxed text-ink-300">
        Moderators you appoint can publish, remove and block comments on{' '}
        <span className="text-ink-100">{channel.name}</span> — and nowhere else. They cannot touch
        your videos, your analytics or your channel settings, and the role does not carry to any
        other channel. Only you can grant it here; an administrator cannot appoint a moderator on
        your behalf.
      </p>

      <Section title={`Moderating ${channel.name}`} className="mt-8">
        {mods.length === 0 ? (
          <EmptyState
            icon={<ShieldHalf className="size-6" />}
            title="No moderators yet"
            body="You are moderating this channel on your own. Appoint someone below when the comments outgrow you."
          />
        ) : (
          <ul className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850">
            {mods.map((id) => {
              const a = accountById(id)!
              return (
                <li key={id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <Avatar name={a.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-fg">{a.name}</p>
                    <p className="truncate font-mono text-[12px] text-ink-300">@{a.handle}</p>
                  </div>
                  <Letterboard tone="neutral">Comments only</Letterboard>
                  <Button size="sm" variant="danger" onClick={() => setConfirm(id)}>
                    Remove
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Appoint a moderator" className="mt-8">
        <div className="max-w-xl">
          <Field label="Find an account" hint="Search by name or handle. They must already have a Skopia account.">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or @handle"
            />
          </Field>
          {candidates.length > 0 && (
            <ul className="mt-2 divide-y divide-ink-800 overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
              {candidates.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <Avatar name={a.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-fg">{a.name}</p>
                    <p className="truncate font-mono text-[11px] text-ink-300">@{a.handle}</p>
                  </div>
                  <Button size="sm" onClick={() => grant(a)}>Appoint</Button>
                </li>
              ))}
            </ul>
          )}
          {query.length > 1 && candidates.length === 0 && (
            <p className="mt-2 text-[13px] text-ink-300">
              No account matches “{query}”.
            </p>
          )}
        </div>
      </Section>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Remove ${target?.name ?? ''} as a moderator?`}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Keep them</Button>
            <Button variant="danger" onClick={() => confirm && revoke(confirm)}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          They lose access to this channel's comment queue immediately. Decisions they already made
          stay as they are, and stay attributed to them in the log.
        </p>
      </Modal>
    </BackOfHouse>
  )
}

/* ========================================================= channel settings */

export function ChannelSettings() {
  const { viewer } = useSession()
  const channel = ownedChannel(viewer)!
  const toast = useToast()
  const [name, setName] = useState(channel.name)

  return (
    <BackOfHouse title="Channel settings">
      <div className="max-w-xl space-y-5">
        <Field label="Channel name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Handle" hint="Changing this breaks existing links to your channel.">
          <Input value={channel.handle} readOnly className="text-ink-300" />
        </Field>
        <div>
          <p className="letterboard text-ink-300">Opened</p>
          <p className="mt-1 font-mono text-[13px] text-ink-150">{channel.created}</p>
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="primary" onClick={() => toast({ title: 'Channel updated.', tone: 'ok' })}>
            Save changes
          </Button>
        </div>
      </div>
    </BackOfHouse>
  )
}
