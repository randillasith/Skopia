import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Upload, Plus, AlertTriangle, Check, Film, Trash2, Archive, Eye, ThumbsUp,
  MessageSquare, TrendingUp, FileVideo, Captions, ArrowLeft, ArrowRight,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Textarea, Table, Th, Td, Tr, EmptyState,
  Modal, Placeholder, useToast, Checkbox, Section,
} from '@/components/primitives'
import { PosterPlate, Letterboard, BillingBoard, Stations, Lightbox } from '@/components/world'
import { BackOfHouse } from '@/components/Shell'
import { VIDEOS, CATEGORIES, GENRES, byId, fmt, UNDECIDED } from '@/lib/data'

const EASE = [0.16, 1, 0.3, 1] as const
const MINE = VIDEOS.filter((v) => ['Meridian Films', 'Harbour Studio'].includes(v.creator))

/* ========================================================= video library */

export function StudioLibrary() {
  const [confirm, setConfirm] = useState<string | null>(null)
  const toast = useToast()
  const target = confirm ? byId(confirm) : undefined

  return (
    <BackOfHouse
      title="Video library"
      actions={
        <Button variant="primary" size="sm" icon={<Plus className="size-4" />}
          onClick={() => (window.location.href = '/studio/upload')}>
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
            <p className="font-marquee mt-1 text-[26px] font-bold tabular-nums text-white">{value}</p>
          </div>
        ))}
      </div>

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
                        <PosterPlate title={v.title} seed={v.seed} compact lettering={false} />
                      </span>
                    </span>
                    <span className="font-marquee font-bold text-white group-hover:text-violet-200">
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
                    <Button size="sm" variant="quiet" onClick={() => (window.location.href = `/studio/video/${v.id}`)}>
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

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Delete “${target?.title}”?`}
        width="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(null)}>Keep it</Button>
            <Button variant="secondary" icon={<Archive className="size-4" />}
              onClick={() => { setConfirm(null); toast({ title: 'Archived — hidden from viewers, record kept' }) }}>
              Archive instead
            </Button>
            <Button variant="danger" onClick={() => { setConfirm(null); toast({ title: 'Video deleted', tone: 'bad' }) }}>
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
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [genre, setGenre] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploaded, setUploaded] = useState(false)
  const [progress, setProgress] = useState(0)

  /** UC-FR1-03 extension 5b — warn on a possible duplicate before confirmation. */
  const duplicate = VIDEOS.find(
    (v) => title.trim().length > 3 && v.title.toLowerCase().startsWith(title.trim().toLowerCase().slice(0, 6)),
  )

  const startUpload = () => {
    setUploaded(true)
    let p = 0
    const id = window.setInterval(() => {
      p += 8 + Math.random() * 12
      setProgress(Math.min(100, p))
      if (p >= 100) {
        window.clearInterval(id)
        window.setTimeout(() => setStep(1), 400)
      }
    }, 180)
  }

  const validateDetails = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'A title is required before this record can be saved.'
    if (!category) e.category = 'Choose the category viewers will find this under.'
    if (!genre) e.genre = 'Choose a genre.'
    if (synopsis.trim().length < 20) e.synopsis = 'Write at least a sentence describing the video.'
    setErrors(e)
    if (Object.keys(e).length === 0) setStep(2)
  }

  return (
    <BackOfHouse title="Upload a video">
      <div className="mx-auto max-w-3xl">
        <Stations steps={UPLOAD_STEPS} active={step} pointOfNoReturn={4} />
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-300">
          <AlertTriangle className="size-3.5 text-warning-400" />
          Nothing is visible to viewers until you publish at the last station.
        </p>

        <div className="mt-8">
          {/* ---- 0 · file ---- */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
              {!uploaded ? (
                <button
                  onClick={startUpload}
                  className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-ink-600 bg-ink-850/50 px-6 py-16 text-center transition-colors hover:border-violet-500/60 hover:bg-violet-500/4"
                >
                  <FileVideo className="size-9 text-ink-300" />
                  <p className="font-marquee mt-4 text-[19px] font-bold text-white">
                    Choose a video file
                  </p>
                  <p className="mt-1.5 text-[14px] text-ink-300">or drag it here</p>
                  <p className="mt-4 text-[12.5px] text-ink-300">
                    Accepted formats and maximum size are not yet defined in the project
                    documentation.
                  </p>
                </button>
              ) : (
                <div className="rounded-lg border border-ink-700 bg-ink-850 p-6">
                  <div className="flex items-center gap-3">
                    <Film className="size-5 text-cyan-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-white">
                        placeholder-master.mov
                      </p>
                      <p className="font-mono text-[12px] tabular-nums text-ink-300">
                        {progress < 100 ? `Uploading… ${Math.round(progress)}%` : 'Upload complete'}
                      </p>
                    </div>
                    {progress >= 100 && <Check className="size-5 text-success-400" />}
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-700">
                    <motion.div
                      className="h-full rounded-full bg-violet-500"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>
              )}
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
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-400" />
                  <div className="text-[13.5px] leading-relaxed">
                    <p className="font-medium text-warning-400">This may be a duplicate</p>
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
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Genre" required error={errors.genre}>
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

              <Field label="Thumbnail" hint="16:9 recommended">
                <div className="flex items-center gap-4">
                  <Lightbox className="w-40">
                    <span className="block aspect-video">
                      <PosterPlate title={title || 'Untitled'} seed={title.length + 2} compact />
                    </span>
                  </Lightbox>
                  <Button size="sm" icon={<Upload className="size-4" />}>Replace thumbnail</Button>
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
                  <Captions className="size-5 text-cyan-400" />
                  <div>
                    <p className="text-[15px] font-medium text-white">Caption tracks</p>
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
                <p className="text-[15px] font-medium text-white">Playback settings</p>
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
                    <h2 className="font-marquee text-[22px] font-bold text-white">{title}</h2>
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
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-400" />
                <p className="text-[13.5px] leading-relaxed text-ink-200">
                  Publishing makes this visible to viewers and starts collecting views and comments.
                  You can archive it afterwards, but the earlier stations close.
                </p>
              </div>

              <div className="mt-5 flex justify-between">
                <Button variant="quiet" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(2)}>Back</Button>
                <div className="flex gap-2">
                  <Button onClick={() => { toast({ title: 'Saved as a draft' }); nav('/studio') }}>
                    Save as draft
                  </Button>
                  <Button variant="primary" onClick={() => { setStep(4); toast({ title: 'Published — now showing', tone: 'ok' }) }}>
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
              <Check className="mx-auto size-9 text-success-400" />
              <h2 className="font-marquee mt-4 text-[24px] font-bold text-white">{title} is now showing</h2>
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
  const { id } = useParams()
  const v = byId(id ?? '')
  const toast = useToast()

  if (!v) {
    return (
      <BackOfHouse title="Video not found">
        <EmptyState title="No such video" body="That record does not exist, or it has been deleted."
          action={<Button onClick={() => (window.location.href = '/studio')}>Back to library</Button>} />
      </BackOfHouse>
    )
  }

  return (
    <BackOfHouse
      title={v.title}
      actions={
        <>
          <Button size="sm" variant="quiet" onClick={() => (window.location.href = `/watch/${v.id}`)}>
            View as a viewer
          </Button>
          <Button size="sm" variant="primary" onClick={() => toast({ title: 'Changes saved', tone: 'ok' })}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <Field label="Title" required><Input defaultValue={v.title} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" required>
              <Select defaultValue={v.category}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
            </Field>
            <Field label="Genre" required>
              <Select defaultValue={v.genre}>{GENRES.map((g) => <option key={g}>{g}</option>)}</Select>
            </Field>
          </div>
          <Field label="Synopsis" required><Textarea defaultValue={v.synopsis} /></Field>

          <div className="rounded-lg border border-ink-700 bg-ink-850 p-5">
            <p className="text-[15px] font-medium text-white">Playback settings</p>
            <div className="mt-3 space-y-3">
              <Checkbox checked onChange={() => {}} label="Allow comments" />
              <Checkbox checked onChange={() => {}} label="Allow sharing" />
              <Checkbox checked={v.premium} onChange={() => {}} label="Premium — requires an active pass" />
            </div>
          </div>

          <div className="rounded-lg border border-danger-500/30 bg-danger-500/6 p-5">
            <h2 className="font-marquee text-[16px] font-bold text-danger-400">Take this down</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-300">
              Archiving hides it from viewers and keeps the record. Deleting removes it and its
              comments for good.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" icon={<Archive className="size-4" />}
                onClick={() => toast({ title: 'Archived' })}>Archive</Button>
              <Button variant="danger" icon={<Trash2 className="size-4" />}
                onClick={() => toast({ title: 'Deleted', tone: 'bad' })}>Delete</Button>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div>
            <p className="letterboard mb-2 text-ink-300">Thumbnail</p>
            <Lightbox>
              <span className="block aspect-video"><PosterPlate title={v.title} seed={v.seed} compact /></span>
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
                  <dd className="font-mono tabular-nums text-white">{value}</dd>
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
  const total = MINE.reduce((s, v) => s + v.views, 0)
  const max = Math.max(...MINE.map((v) => v.views))

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
            <p className="font-marquee mt-1 text-[28px] font-bold tabular-nums text-white">{v}</p>
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
                    <Link to={`/studio/video/${v.id}`} className="font-marquee truncate text-[15px] font-bold text-white hover:text-violet-200">
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
