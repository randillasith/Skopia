/**
 * FR5 — the advertising console.
 *
 * Every figure and every status on these screens comes from the API. Nothing is
 * recomputed in the browser: a campaign already knows whether it has expired, and
 * CTR is already a number, because two definitions of the same percentage is how a
 * dashboard and a report end up disagreeing about the same campaign.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Plus, Megaphone, AlertTriangle, ArrowLeft, ArrowRight, Check, Upload, Link2,
  Play, Pause, MousePointerClick, Eye, Target, CalendarRange, Archive,
  Download, Loader2, RefreshCw, X, Pencil, Trash2,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Table, Th, Td, Tr, Tabs, Modal,
  EmptyState, Checkbox, useToast, Section, SearchInput,
} from '@/components/primitives'
import { Letterboard, Stations, Lightbox, PosterPlate } from '@/components/world'
import { BackOfHouse } from '@/components/Shell'
import { ApiError } from '@/lib/api'
import {
  ads, dateOnly, endOfDay, startOfDay, SLOT_LABEL, STATUS_TONE,
  type AdType, type Advertisement, type Campaign, type CampaignStatus, type Metrics,
  type Placement, type SlotPosition, type TargetOption,
} from '@/lib/ads'
import { useAdvertisingActor, useApiData } from '@/lib/useAdvertising'
import { cn } from '@/lib/cn'

const EASE = [0.16, 1, 0.3, 1] as const

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`

/* ====================================================== shared screen states */

function Loading({ what }: { what: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-ink-300">
      <Loader2 className="size-4 animate-spin" />
      <p className="text-[13.5px]">Loading {what}…</p>
    </div>
  )
}

/**
 * A failure, said out loud.
 *
 * Being refused and being unable to reach the API are different problems with
 * different answers, so they are not collapsed into one "something went wrong".
 */
function Failed({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-danger-500/35 bg-danger-500/8 px-5 py-4 sm:flex-row sm:items-center">
      <AlertTriangle className="size-4 shrink-0 text-danger-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-relaxed text-ink-100">{error.message}</p>
        {error.status === 0 && (
          <p className="mt-1 text-[12.5px] text-ink-300">
            Start the API with <code className="font-mono text-ink-200">./mvnw spring-boot:run</code>,
            then try again.
          </p>
        )}
      </div>
      {onRetry && error.status === 0 && (
        <Button size="sm" icon={<RefreshCw className="size-4" />} onClick={onRetry}>Try again</Button>
      )}
    </div>
  )
}

/** Wraps a screen in the actor lookup every advertising call depends on. */
function WithActor({
  title,
  actions,
  children,
}: {
  title: string
  actions?: React.ReactNode
  children: (actorId: number, canOwn: boolean) => React.ReactNode
}) {
  const { actor, loading, error } = useAdvertisingActor()

  return (
    <BackOfHouse title={title} actions={actor ? actions : undefined}>
      {loading ? (
        <Loading what="your advertising access" />
      ) : error || !actor ? (
        <Failed error={error ?? new ApiError(403, 'This account cannot manage advertising.')} />
      ) : (
        children(actor.actorId, actor.canOwnCampaigns)
      )}
    </BackOfHouse>
  )
}

/* ========================================================== campaign list */

const TABS: { id: string; label: string; status?: CampaignStatus }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active', status: 'ACTIVE' },
  { id: 'scheduled', label: 'Scheduled', status: 'SCHEDULED' },
  { id: 'draft', label: 'Drafts', status: 'DRAFT' },
  { id: 'expired', label: 'Expired', status: 'EXPIRED' },
]

export function CampaignList() {
  const nav = useNavigate()

  return (
    <WithActor
      title="Campaigns"
      actions={
        <Button variant="primary" size="sm" icon={<Plus className="size-4" />}
          onClick={() => nav('/campaigns/new')}>
          New campaign
        </Button>
      }
    >
      {(actorId) => <CampaignListBody actorId={actorId} />}
    </WithActor>
  )
}

function CampaignListBody({ actorId }: { actorId: number }) {
  const nav = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [sweeping, setSweeping] = useState(false)

  const { data, loading, error, reload } = useApiData<Campaign[]>(
    (signal) => ads.campaigns.list(actorId, { search: q.trim() || undefined }).then((r) => {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError')
      return r
    }),
    [actorId, q],
  )

  const all = useMemo(() => data ?? [], [data])
  const counted = useMemo(() => {
    const byStatus = (s: CampaignStatus) => all.filter((c) => c.status === s).length
    return TABS.map((t) => ({
      ...t,
      count: t.status ? byStatus(t.status) : all.length,
    }))
  }, [all])

  const list = useMemo(() => {
    const wanted = TABS.find((t) => t.id === tab)?.status
    return wanted ? all.filter((c) => c.status === wanted) : all
  }, [all, tab])

  const expired = all.filter((c) => c.status === 'EXPIRED')

  const sweep = async () => {
    setSweeping(true)
    try {
      const { updated } = await ads.campaigns.sweepExpired(actorId)
      toast({
        title: updated > 0
          ? `${updated} campaign${updated > 1 ? 's' : ''} brought up to date`
          : 'Everything was already up to date',
        tone: 'ok',
      })
      reload()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Could not run the sweep', tone: 'bad' })
    } finally {
      setSweeping(false)
    }
  }

  if (loading && !data) return <Loading what="campaigns" />
  if (error) return <Failed error={error} onRetry={reload} />

  return (
    <>
      {expired.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-sm border sm:flex-row sm:items-center border-warning-500/35 bg-warning-500/8 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-warning-400" />
          <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-200">
            <span className="font-medium text-warning-400">
              {expired.length} campaign{expired.length > 1 ? 's have' : ' has'} passed its end date.
            </span>{' '}
            Their advertisements stopped being delivered the moment the date passed — archive them
            to clear the list.
          </p>
          <Button size="sm" onClick={sweep} disabled={sweeping}
            icon={sweeping ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}>
            Review expired
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Tabs value={tab} onChange={setTab} tabs={counted} />
        </div>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Find a campaign" className="w-full sm:w-64" />
      </div>

      {list.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Megaphone className="size-7" />}
            title={q.trim() ? 'Nothing matches that' : 'No campaigns here'}
            body={q.trim()
              ? 'No campaign matches that search. Try another word, or clear it.'
              : 'Nothing under this filter yet. Try another tab, or start a new campaign.'}
            action={<Button onClick={() => nav('/campaigns/new')}>New campaign</Button>}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={['Campaign', 'Status', 'Ads', 'Runs', 'Targets', 'Impressions', 'Clicks', 'CTR']}>
            <thead>
              <tr>
                <Th>Campaign</Th><Th>Status</Th><Th numeric>Ads</Th><Th>Runs</Th>
                <Th>Targets</Th><Th numeric>Impressions</Th><Th numeric>Clicks</Th><Th numeric>CTR</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <Tr key={c.id} onClick={() => nav(`/campaigns/${c.id}`)}>
                  <Td>
                    <span className="font-marquee block font-bold text-white">{c.campaignName}</span>
                    <span className="block font-mono text-[11px] text-ink-300">
                      CMP-{c.id}{c.advertiser ? ` · ${c.advertiser}` : ''}
                    </span>
                  </Td>
                  <Td><StatusBoard campaign={c} /></Td>
                  <Td numeric>{c.adCount}</Td>
                  <Td>
                    <span className="font-mono text-[12px] tabular-nums text-ink-300">
                      {dateOnly(c.startDate)} → {dateOnly(c.endDate)}
                    </span>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {c.targets.length === 0
                        ? <span className="text-[12.5px] text-ink-400">None yet</span>
                        : c.targets.slice(0, 3).map((t) => <Letterboard key={t}>{t}</Letterboard>)}
                      {c.targets.length > 3 && (
                        <span className="text-[12px] text-ink-300">+{c.targets.length - 3}</span>
                      )}
                    </span>
                  </Td>
                  <Td numeric>{c.impressions.toLocaleString()}</Td>
                  <Td numeric>{c.clicks.toLocaleString()}</Td>
                  <Td numeric className={cn(c.ctr > 2 ? 'text-success-400' : 'text-ink-200')}>
                    {c.ctr.toFixed(2)}%
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </>
  )
}

/**
 * The status word, plus why it says that.
 *
 * A campaign that lapsed shows EXPIRED while the database still says SCHEDULED.
 * That gap is deliberate — delivery goes by the dates, not by the stored value —
 * and hiding it would make the next expiry sweep look like it changed something.
 */
function StatusBoard({ campaign }: { campaign: Campaign }) {
  const drifted = campaign.status !== campaign.storedStatus
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={drifted
        ? `Recorded as ${campaign.storedStatus}; its dates say ${campaign.status}. The next sweep files it.`
        : undefined}
    >
      <Letterboard tone={STATUS_TONE[campaign.status]}>{campaign.status}</Letterboard>
      {drifted && <span className="text-[11px] text-ink-400">•</span>}
    </span>
  )
}

/* =========================================================== new campaign */

const STEPS = ['Details', 'Creative', 'Targeting', 'Schedule', 'Live']

type ChosenTarget = { kind: 'video' | 'category'; id: number; label: string }

export function CampaignNew() {
  return (
    <WithActor title="New campaign">
      {(actorId, canOwn) =>
        canOwn ? (
          <CampaignWizard actorId={actorId} />
        ) : (
          <Failed error={new ApiError(403,
            'An administrator can read every campaign but cannot own one. Sign in as a marketing officer to create a booking.')} />
        )
      }
    </WithActor>
  )
}

function CampaignWizard({ actorId }: { actorId: number }) {
  const nav = useNavigate()
  const toast = useToast()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [advertiser, setAdvertiser] = useState('')
  const [budget, setBudget] = useState('')
  const [slot, setSlot] = useState<SlotPosition>('PREROLL')

  const [media, setMedia] = useState<{ url: string; type: 'VIDEO' | 'IMAGE'; filename: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [duration, setDuration] = useState('20')
  const [link, setLink] = useState('')

  const [targets, setTargets] = useState<ChosenTarget[]>([])
  const [targetSearch, setTargetSearch] = useState('')

  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [autoStop, setAutoStop] = useState(true)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<Campaign | null>(null)

  const options = useApiData(
    () => ads.targets.options(actorId, targetSearch.trim() || undefined),
    [actorId, targetSearch],
    step === 2,
  )

  const toggleTarget = (t: ChosenTarget) =>
    setTargets((chosen) =>
      chosen.some((x) => x.kind === t.kind && x.id === t.id)
        ? chosen.filter((x) => !(x.kind === t.kind && x.id === t.id))
        : [...chosen, t])

  const isChosen = (kind: 'video' | 'category', id: number) =>
    targets.some((t) => t.kind === kind && t.id === id)

  /* ----------------------------------------------------------- validation */

  const validateDetails = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Give the campaign a name you will recognise in the list.'
    if (!advertiser.trim()) e.advertiser = 'Name the advertiser this runs for.'
    if (budget.trim() && Number(budget) < 0) e.budget = 'A budget cannot be negative.'
    setErrors(e)
    if (!Object.keys(e).length) setStep(1)
  }

  const validateCreative = () => {
    const e: Record<string, string> = {}
    if (!media) e.media = 'Upload the creative a viewer will see.'
    if (!link.trim()) e.link = 'A promotional link is required.'
    else if (!/^https?:\/\/.+/.test(link)) e.link = 'Enter a full URL, starting with http:// or https://'
    setErrors(e)
    if (!Object.keys(e).length) setStep(2)
  }

  const validateTargeting = () => {
    const e: Record<string, string> = {}
    if (targets.length === 0) e.targets = 'Choose at least one title or category to target.'
    setErrors(e)
    if (!Object.keys(e).length) setStep(3)
  }

  /** UC-FR5-01 extension 6a, shown live rather than only on submit. */
  const scheduleError =
    start && end && new Date(end) <= new Date(start)
      ? 'The end date must fall after the start date.'
      : ''

  const upload = async (file: File) => {
    setUploading(true)
    setErrors((e) => ({ ...e, media: '' }))
    try {
      const stored = await ads.advertisements.uploadMedia(actorId, file)
      setMedia({ url: stored.mediaUrl, type: stored.adType, filename: stored.originalFilename })
      // The upload already knows what it handled; asking again is how a video
      // ends up recorded as an image.
      if (stored.adType === 'IMAGE') setDuration('0')
      toast({ title: `${stored.originalFilename} uploaded`, tone: 'ok' })
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'The upload failed.'
      setErrors((prev) => ({ ...prev, media: message }))
    } finally {
      setUploading(false)
    }
  }

  /**
   * Confirming is five calls, in order, and the order matters: an advertisement
   * cannot be activated before it has a target, and a campaign cannot be confirmed
   * before it has an advertisement. If one fails, the campaign is left as a draft
   * with whatever did succeed — recoverable from the campaign's own page, rather
   * than silently half-built.
   */
  const confirm = async () => {
    const e: Record<string, string> = {}
    if (!start) e.start = 'Set the date the campaign starts running.'
    if (!end) e.end = 'Set the date it stops.'
    if (scheduleError) e.end = scheduleError
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    try {
      const campaign = await ads.campaigns.create(actorId, {
        campaignName: name.trim(),
        advertiser: advertiser.trim(),
        startDate: startOfDay(start),
        endDate: endOfDay(end),
        budget: budget.trim() ? Number(budget) : 0,
      })

      const ad = await ads.advertisements.create(actorId, {
        campaignId: campaign.id,
        adTitle: name.trim(),
        mediaUrl: media!.url,
        adType: media!.type,
        adDuration: Number(duration) || 0,
        clickUrl: link.trim(),
      })

      for (const target of targets) {
        await ads.targets.attach(actorId, ad.id, {
          videoId: target.kind === 'video' ? target.id : null,
          categoryId: target.kind === 'category' ? target.id : null,
          slotPosition: slot,
          priority: 1,
        })
      }

      await ads.advertisements.activate(actorId, ad.id)
      const live = await ads.campaigns.confirm(actorId, campaign.id)

      setCreated(live)
      setStep(4)
      toast({ title: 'Campaign confirmed and scheduled', tone: 'ok' })
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError(0, 'Something went wrong.')
      setErrors(error.fields && Object.keys(error.fields).length ? error.fields : {})
      toast({ title: error.message, tone: 'bad' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Stations steps={STEPS} active={step} pointOfNoReturn={4} />

      <div className="mt-8">
        {step === 0 && (
          <Panel>
            <Field label="Campaign name" required error={errors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Autumn Season Launch" invalid={!!errors.name} />
            </Field>
            <Field label="Advertiser" required error={errors.advertiser}>
              <Input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)}
                placeholder="Who is this running for?" invalid={!!errors.advertiser} />
            </Field>
            <Field label="Budget" hint="Recorded against the booking. Delivery is not capped by it."
              error={errors.budget}>
              <Input type="number" min="0" step="0.01" value={budget}
                onChange={(e) => setBudget(e.target.value)} placeholder="2500.00"
                invalid={!!errors.budget} />
            </Field>
            <Field label="Placement" required hint="Where the advertisement appears">
              <Select value={slot} onChange={(e) => setSlot(e.target.value as SlotPosition)}>
                {(Object.keys(SLOT_LABEL) as SlotPosition[]).map((s) => (
                  <option key={s} value={s}>{SLOT_LABEL[s]}</option>
                ))}
              </Select>
            </Field>
            <Nav onNext={validateDetails} nextLabel="Continue to creative" />
          </Panel>
        )}

        {step === 1 && (
          <Panel>
            <Field label="Advertisement media" required error={errors.media}
              hint="MP4, WebM or MOV up to 50 MB — or PNG, JPEG, WebP or GIF">
              <label className={cn(
                'flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
                media ? 'border-success-500/50 bg-success-500/5' : 'border-ink-600 bg-ink-950 hover:border-violet-500/60',
              )}>
                <input
                  type="file"
                  className="sr-only"
                  accept=".mp4,.webm,.mov,.png,.jpg,.jpeg,.webp,.gif"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) upload(file)
                    // Cleared so choosing the same file twice still fires.
                    e.target.value = ''
                  }}
                />
                {uploading ? (
                  <>
                    <Loader2 className="size-7 animate-spin text-ink-300" />
                    <p className="mt-3 text-[14px] font-medium text-white">Uploading…</p>
                  </>
                ) : media ? (
                  <>
                    <Check className="size-7 text-success-400" />
                    <p className="mt-3 text-[14px] font-medium text-white">{media.filename}</p>
                    <p className="mt-1 text-[12.5px] text-ink-300">
                      Stored as {media.type === 'VIDEO' ? 'a video' : 'an image'}. Choose another to replace it.
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="size-7 text-ink-300" />
                    <p className="mt-3 text-[14px] font-medium text-white">Upload creative</p>
                    <p className="mt-1 text-[12.5px] text-ink-300">Video or image, up to 50 MB</p>
                  </>
                )}
              </label>
            </Field>

            {media?.type === 'VIDEO' && (
              <Field label="Duration" hint="Seconds the advertisement runs for">
                <Input type="number" min="0" value={duration}
                  onChange={(e) => setDuration(e.target.value)} />
              </Field>
            )}

            <Field label="Promotional link" required error={errors.link}
              hint="Where a click sends the viewer">
              <Input value={link} onChange={(e) => setLink(e.target.value)}
                placeholder="https://example.com/campaign" invalid={!!errors.link} />
            </Field>

            <div>
              <p className="letterboard mb-2 text-ink-300">Preview — as a viewer sees it</p>
              <Lightbox>
                <div className="relative aspect-video">
                  <CreativePreview url={media?.url} type={media?.type} title={name} />
                  <div className="absolute inset-x-0 top-0 flex justify-start p-3">
                    <Letterboard tone="held">Advertisement</Letterboard>
                  </div>
                </div>
              </Lightbox>
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-300">
                <Check className="size-3.5 text-success-400" />
                Every advertisement is labelled as advertising. This cannot be turned off.
              </p>
            </div>

            <Nav onBack={() => setStep(0)} onNext={validateCreative} nextLabel="Continue to targeting" />
          </Panel>
        )}

        {step === 2 && (
          <Panel>
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="flex items-baseline gap-2 text-[13px] font-medium text-ink-150">
                  Target titles and categories <span className="text-danger-400">*</span>
                </p>
                <SearchInput value={targetSearch} onChange={(e) => setTargetSearch(e.target.value)}
                  placeholder="Search the programme" className="ml-auto w-full sm:w-56" />
              </div>

              {options.loading && !options.data ? (
                <Loading what="the programme" />
              ) : options.error ? (
                <Failed error={options.error} onRetry={options.reload} />
              ) : (
                <div className="space-y-5">
                  <TargetGroup
                    heading="Categories"
                    note="Reaches every title in the category, including ones added later."
                    options={options.data?.categories ?? []}
                    isChosen={(id) => isChosen('category', id)}
                    onToggle={(o) => toggleTarget({ kind: 'category', id: o.id, label: o.label })}
                  />
                  <TargetGroup
                    heading="Titles"
                    note="Reaches exactly this title."
                    options={options.data?.videos ?? []}
                    isChosen={(id) => isChosen('video', id)}
                    onToggle={(o) => toggleTarget({ kind: 'video', id: o.id, label: o.label })}
                  />
                </div>
              )}

              {errors.targets && <p className="mt-2 text-[12px] text-danger-400">{errors.targets}</p>}
            </div>

            <div className="rounded-sm border border-ink-700 bg-ink-850 px-4 py-3">
              <p className="flex items-center gap-2 text-[13.5px] text-ink-200">
                <Target className="size-4 shrink-0 text-cyan-400" />
                {targets.length === 0
                  ? 'No targets chosen — this campaign would not be delivered anywhere.'
                  : `${targets.length} target${targets.length === 1 ? '' : 's'} chosen: ${targets.map((t) => t.label).join(', ')}`}
              </p>
            </div>

            <Nav onBack={() => setStep(1)} onNext={validateTargeting} nextLabel="Continue to schedule" />
          </Panel>
        )}

        {step === 3 && (
          <Panel>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Start date" required error={errors.start}>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                  invalid={!!errors.start} />
              </Field>
              <Field label="End date" required error={errors.end}>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                  invalid={!!errors.end} />
              </Field>
            </div>

            {scheduleError && (
              <div className="flex items-start gap-2.5 rounded-sm border border-danger-500/35 bg-danger-500/8 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-400" />
                <p className="text-[13.5px] text-ink-200">{scheduleError}</p>
              </div>
            )}

            <div className="rounded-sm border border-ink-700 bg-ink-850 px-4 py-3">
              <p className="flex items-start gap-2 text-[13.5px] text-ink-200">
                <CalendarRange className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                The advertisement is shown only between these dates. After the end date it stops
                being delivered automatically — the serving engine checks the dates on every
                request, so this does not wait for anything to run.
              </p>
            </div>

            <Checkbox
              checked={autoStop}
              onChange={() => setAutoStop(true)}
              label="Deactivate automatically once the end date passes"
            />
            <p className="-mt-2 text-[12px] text-ink-400">
              Always on. Delivery is decided by the dates, so this cannot be turned off.
            </p>

            <Nav onBack={() => setStep(2)} onNext={confirm}
              nextLabel={saving ? 'Confirming…' : 'Confirm campaign'} busy={saving} primary />
          </Panel>
        )}

        {step === 4 && created && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="rounded-lg border border-success-500/35 bg-success-500/6 p-8 text-center">
            <Check className="mx-auto size-9 text-success-400" />
            <h2 className="font-marquee mt-4 text-[24px] font-bold text-white">
              {created.campaignName} is {created.status === 'ACTIVE' ? 'running' : 'scheduled'}
            </h2>
            <p className="mx-auto mt-2 max-w-[50ch] text-[14px] leading-relaxed text-ink-300">
              It runs from {dateOnly(created.startDate)} to {dateOnly(created.endDate)} against{' '}
              {created.targets.length} target{created.targets.length === 1 ? '' : 's'}, and stops on
              its own afterwards.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <Button variant="primary" onClick={() => nav(`/campaigns/${created.id}`)}>
                Open the campaign
              </Button>
              <Button onClick={() => nav('/campaigns')}>Back to campaigns</Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function TargetGroup({
  heading, note, options, isChosen, onToggle,
}: {
  heading: string
  note: string
  options: TargetOption[]
  isChosen: (id: number) => boolean
  onToggle: (option: TargetOption) => void
}) {
  if (options.length === 0) {
    return (
      <div>
        <p className="letterboard mb-2 text-ink-300">{heading}</p>
        <p className="text-[12.5px] text-ink-400">Nothing here to target yet.</p>
      </div>
    )
  }
  return (
    <div>
      <p className="letterboard mb-1 text-ink-300">{heading}</p>
      <p className="mb-2.5 text-[12px] text-ink-400">{note}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o)}
            aria-pressed={isChosen(o.id)}
            title={o.sublabel ?? undefined}
            className={cn(
              'rounded-sm border px-3 py-1.5 text-[13px] transition-colors',
              isChosen(o.id)
                ? 'border-violet-400 bg-violet-500/18 text-violet-100'
                : 'border-ink-600 bg-ink-850 text-ink-200 hover:border-ink-500',
            )}
          >
            {o.label}
            {o.count != null && (
              <span className="ml-1.5 font-mono text-[11px] text-ink-400">{o.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The creative itself once uploaded, and the poster plate until then. */
function CreativePreview({
  url, type, title,
}: { url?: string; type?: 'VIDEO' | 'IMAGE'; title?: string }) {
  if (url && type === 'IMAGE') {
    return <img src={url} alt="" className="size-full object-cover" />
  }
  if (url && type === 'VIDEO') {
    return <video src={url} muted playsInline controls className="size-full bg-black object-contain" />
  }
  return (
    <>
      <PosterPlate title={title || 'Your campaign'} seed={(title?.length ?? 0) + 4} compact lettering={false} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-950/65 text-center">
        <p className="font-marquee text-[20px] font-bold text-white">{title || 'Your campaign'}</p>
        <p className="text-[12px] text-ink-300">Creative appears here once uploaded</p>
      </div>
    </>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }} className="space-y-5">
      {children}
    </motion.div>
  )
}

function Nav({
  onBack, onNext, nextLabel, busy,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel: string
  busy?: boolean
  primary?: boolean
}) {
  return (
    <div className="flex justify-between pt-2">
      {onBack ? (
        <Button variant="quiet" icon={<ArrowLeft className="size-4" />} onClick={onBack} disabled={busy}>
          Back
        </Button>
      ) : <span />}
      <Button
        variant="primary"
        icon={busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        onClick={onNext}
        disabled={busy}
      >
        {nextLabel}
      </Button>
    </div>
  )
}

/* ======================================================== campaign detail */

export function CampaignDetail() {
  const { id } = useParams()
  const campaignId = Number(id)

  return (
    <WithActor title="Campaign">
      {(actorId) => <CampaignDetailBody actorId={actorId} campaignId={campaignId} />}
    </WithActor>
  )
}

function CampaignDetailBody({ actorId, campaignId }: { actorId: number; campaignId: number }) {
  const nav = useNavigate()
  const toast = useToast()
  const [archiving, setArchiving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingAd, setAddingAd] = useState(false)
  const [busy, setBusy] = useState(false)

  const campaign = useApiData(() => ads.campaigns.get(actorId, campaignId), [actorId, campaignId])
  const adverts = useApiData(
    () => ads.advertisements.forCampaign(actorId, campaignId), [actorId, campaignId])
  const metrics = useApiData<Metrics>(
    () => ads.campaigns.metrics(actorId, campaignId), [actorId, campaignId])

  const reloadAll = useCallback(() => {
    campaign.reload()
    adverts.reload()
    metrics.reload()
  }, [campaign, adverts, metrics])

  const act = async (what: string, run: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await run()
      toast({ title: what, tone: 'ok' })
      reloadAll()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'That did not work', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  if (campaign.loading && !campaign.data) return <Loading what="this campaign" />
  if (campaign.error) {
    return campaign.error.status === 404 ? (
      <EmptyState title="No such campaign" body="That campaign does not exist or has been removed."
        action={<Button onClick={() => nav('/campaigns')}>Back to campaigns</Button>} />
    ) : (
      <Failed error={campaign.error} onRetry={campaign.reload} />
    )
  }

  const c = campaign.data!
  const expired = c.status === 'EXPIRED'
  const archived = c.status === 'ARCHIVED'
  const list = adverts.data ?? []
  const lead = list[0]
  // Nothing about an archived campaign may change: it is kept as the record of
  // what ran. Everything else is still a working booking, draft or not.
  const editable = !archived

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-white">
          <ArrowLeft className="size-4" /> All campaigns
        </Link>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button size="sm" variant="quiet" icon={<Pencil className="size-4" />}
              onClick={() => setEditing(true)}>
              Edit details
            </Button>
          )}
          {c.status === 'ACTIVE' || c.status === 'SCHEDULED' ? (
            <Button size="sm" icon={<Pause className="size-4" />} disabled={busy}
              onClick={() => act('Campaign paused', () => ads.campaigns.pause(actorId, c.id))}>
              Pause
            </Button>
          ) : c.status === 'PAUSED' ? (
            <Button size="sm" icon={<Play className="size-4" />} disabled={busy}
              onClick={() => act('Campaign resumed', () => ads.campaigns.resume(actorId, c.id))}>
              Resume
            </Button>
          ) : null}
          {c.status === 'DRAFT' && (
            <Button size="sm" variant="primary" icon={<Check className="size-4" />} disabled={busy}
              onClick={() => act('Campaign confirmed', () => ads.campaigns.confirm(actorId, c.id))}>
              Confirm
            </Button>
          )}
          {!archived && (
            <Button size="sm" variant="danger" icon={<Archive className="size-4" />}
              onClick={() => setArchiving(true)}>
              Archive
            </Button>
          )}
        </div>
      </div>

      <h1 className="font-marquee mt-4 text-[28px] font-bold tracking-tight text-white">
        {c.campaignName}
      </h1>

      {expired && (
        <div className="mt-4 flex items-start gap-2.5 rounded-sm border border-warning-500/35 bg-warning-500/8 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-400" />
          <p className="text-[13.5px] leading-relaxed text-ink-200">
            This campaign ended on {dateOnly(c.endDate)} and is no longer being delivered. Its
            recorded performance is kept for reporting.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBoard campaign={c} />
            <Letterboard>
              {c.adCount === 1 ? '1 advertisement' : `${c.adCount} advertisements`}
            </Letterboard>
          </div>

          <dl className="mt-6 grid gap-5 border-y border-ink-800 py-5 sm:grid-cols-3">
            {[
              ['Advertiser', c.advertiser ?? '—'],
              ['Runs', `${dateOnly(c.startDate)} → ${dateOnly(c.endDate)}`],
              ['Reference', `CMP-${c.id}`],
              ['Budget', c.budget != null ? c.budget.toLocaleString() : '—'],
              ['Booked by', c.createdByName ?? '—'],
              ['Advertisements', String(c.adCount)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="letterboard text-ink-300">{k}</dt>
                <dd className="mt-1 font-mono text-[13px] tabular-nums text-ink-100">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              [<Eye key="e" className="size-4" />, 'Impressions', c.impressions.toLocaleString()],
              [<MousePointerClick key="c" className="size-4" />, 'Clicks', c.clicks.toLocaleString()],
              [<Target key="t" className="size-4" />, 'CTR', `${c.ctr.toFixed(2)}%`],
            ].map(([icon, label, value]) => (
              <div key={label as string} className="rounded-lg border border-ink-700 bg-ink-850 p-4">
                <p className="letterboard flex items-center gap-1.5 text-ink-300">{icon}{label}</p>
                <p className="font-marquee mt-1.5 text-[24px] font-bold tabular-nums text-white">{value}</p>
              </div>
            ))}
          </div>

          {/*
            The advertisements are the campaign, so they are the page rather than a
            footnote to it. Each one carries its own creative, its own delivery
            figures and its own targeting, because that is the unit an officer
            actually switches on and off.
          */}
          <div className="mt-8">
            <Section
              title="Advertisements"
              action={editable ? (
                <Button size="sm" variant="primary" icon={<Plus className="size-4" />}
                  onClick={() => setAddingAd(true)}>
                  Add advertisement
                </Button>
              ) : undefined}
            >
              {adverts.loading && !adverts.data ? (
                <p className="text-[12.5px] text-ink-400">Loading…</p>
              ) : adverts.error ? (
                <Failed error={adverts.error} onRetry={adverts.reload} />
              ) : list.length === 0 ? (
                <div className="rounded-lg border border-dashed border-ink-600 bg-ink-900/40 px-5 py-8 text-center">
                  <p className="text-[13.5px] text-ink-200">
                    This campaign has no advertisements yet.
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-400">
                    A campaign with none cannot be confirmed — there would be nothing to deliver.
                  </p>
                  {editable && (
                    <Button className="mt-4" size="sm" variant="primary"
                      icon={<Plus className="size-4" />} onClick={() => setAddingAd(true)}>
                      Add the first advertisement
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="space-y-4">
                  {list.map((ad) => (
                    <AdvertisementCard key={ad.id} actorId={actorId} ad={ad}
                      campaign={c} editable={editable} onChanged={reloadAll} />
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {metrics.data && metrics.data.impressions > 0 && (
            <div className="mt-8">
              <Section
                title="Performance"
                action={
                  <a href={ads.campaigns.csvUrl(c.id)} download
                    className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-white">
                    <Download className="size-3.5" /> Export CSV
                  </a>
                }
              >
                <Breakdowns metrics={metrics.data} />
              </Section>
            </div>
          )}
        </div>

        <aside>
          <p className="letterboard mb-2 text-ink-300">
            {list.length > 1 ? 'Lead creative' : 'Creative'}
          </p>
          <Lightbox>
            <div className="relative aspect-video">
              <CreativePreview url={lead?.mediaUrl} type={lead?.adType} title={c.campaignName} />
              <div className="absolute inset-x-0 top-0 flex justify-start p-3">
                <Letterboard tone="held">Advertisement</Letterboard>
              </div>
            </div>
          </Lightbox>
          {list.length > 1 && (
            <p className="mt-2 text-[12px] text-ink-400">
              {list.length - 1} more {list.length === 2 ? 'advertisement runs' : 'advertisements run'}{' '}
              under this campaign.
            </p>
          )}
        </aside>
      </div>

      <CampaignEditModal
        open={editing}
        actorId={actorId}
        campaign={c}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); reloadAll() }}
      />

      <AdvertisementFormModal
        open={addingAd}
        actorId={actorId}
        campaignId={c.id}
        onClose={() => setAddingAd(false)}
        onSaved={() => { setAddingAd(false); reloadAll() }}
      />

      <Modal
        open={archiving}
        onClose={() => setArchiving(false)}
        title={`Archive “${c.campaignName}”?`}
        width="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setArchiving(false)}>Keep it</Button>
            <Button variant="danger" disabled={busy} onClick={async () => {
              setArchiving(false)
              await act('Campaign archived', () => ads.campaigns.archive(actorId, c.id))
            }}>
              Archive campaign
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          Every advertisement under it stops being delivered immediately. Recorded impressions and
          clicks are kept so past reporting stays accurate — which is why this archives rather than
          deletes.
        </p>
      </Modal>
    </>
  )
}

/* ------------------------------------------------------ campaign details */

function CampaignEditModal({
  open, actorId, campaign, onClose, onSaved,
}: {
  open: boolean
  actorId: number
  campaign: Campaign
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(campaign.campaignName)
  const [advertiser, setAdvertiser] = useState(campaign.advertiser ?? '')
  const [budget, setBudget] = useState(campaign.budget == null ? '' : String(campaign.budget))
  const [start, setStart] = useState(dateOnly(campaign.startDate))
  const [end, setEnd] = useState(dateOnly(campaign.endDate))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Reopening after a cancelled edit should show the campaign as it stands, not
  // the half-typed version that was abandoned.
  useEffect(() => {
    if (!open) return
    setName(campaign.campaignName)
    setAdvertiser(campaign.advertiser ?? '')
    setBudget(campaign.budget == null ? '' : String(campaign.budget))
    setStart(dateOnly(campaign.startDate))
    setEnd(dateOnly(campaign.endDate))
    setErrors({})
  }, [open, campaign])

  const save = async () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Give the campaign a name you will recognise in the list.'
    if (budget.trim() && Number(budget) < 0) e.budget = 'A budget cannot be negative.'
    if (!start) e.start = 'Set the date the campaign starts running.'
    if (!end) e.end = 'Set the date it stops.'
    else if (start && new Date(end) <= new Date(start)) {
      e.end = 'The end date must fall after the start date.'
    }
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    try {
      await ads.campaigns.update(actorId, campaign.id, {
        campaignName: name.trim(),
        advertiser: advertiser.trim() || null,
        startDate: startOfDay(start),
        endDate: endOfDay(end),
        budget: budget.trim() ? Number(budget) : 0,
      })
      toast({ title: 'Campaign updated', tone: 'ok' })
      onSaved()
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError(0, 'Something went wrong.')
      setErrors(error.fields ?? {})
      toast({ title: error.message, tone: 'bad' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Campaign details"
      description="Changing the dates moves every advertisement under this campaign with it."
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}
            icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Campaign name" required error={errors.campaignName ?? errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)}
            invalid={!!(errors.campaignName ?? errors.name)} />
        </Field>
        <Field label="Advertiser" error={errors.advertiser}>
          <Input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)}
            placeholder="Who is this running for?" invalid={!!errors.advertiser} />
        </Field>
        <Field label="Budget" hint="Recorded against the booking. Delivery is not capped by it."
          error={errors.budget}>
          <Input type="number" min="0" step="0.01" value={budget}
            onChange={(e) => setBudget(e.target.value)} invalid={!!errors.budget} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" required error={errors.startDate ?? errors.start}>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)}
              invalid={!!(errors.startDate ?? errors.start)} />
          </Field>
          <Field label="Ends" required error={errors.endDate ?? errors.end}>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              invalid={!!(errors.endDate ?? errors.end)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------- advertisements */

/**
 * One advertisement inside a campaign, with everything that belongs to it.
 *
 * <p>Targeting lives here rather than at campaign level because it is attached to
 * the advertisement: a campaign-wide list of targets cannot say which creative
 * each one carries, which is the first question asked when two are running.
 */
function AdvertisementCard({
  actorId, ad, campaign, editable, onChanged,
}: {
  actorId: number
  ad: Advertisement
  campaign: Campaign
  editable: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [editingAd, setEditingAd] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingTarget, setAddingTarget] = useState(false)

  const run = async (what: string, work: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await work()
      toast({ title: what, tone: 'ok' })
      onChanged()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'That did not work', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  const toggle = () =>
    ad.status === 'ACTIVE'
      ? run(`${ad.adTitle} switched off`, () => ads.advertisements.deactivate(actorId, ad.id))
      : run(`${ad.adTitle} switched on`, () => ads.advertisements.activate(actorId, ad.id))

  return (
    <li className="rounded-lg border border-ink-700 bg-ink-850">
      <div className="flex flex-wrap items-start gap-4 p-4">
        <div className="w-28 shrink-0 overflow-hidden rounded-sm border border-ink-700">
          <div className="relative aspect-video">
            <CreativePreview url={ad.mediaUrl} type={ad.adType} title={ad.adTitle} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-medium text-white">{ad.adTitle}</p>
            <Letterboard tone={ad.status === 'ACTIVE' ? (ad.servable ? 'live' : 'review') : 'neutral'}>
              {ad.status}
            </Letterboard>
            {ad.status === 'ACTIVE' && !ad.servable && (
              <span className="text-[12px] text-ink-400"
                title="Switched on, but its campaign is not running">
                not running
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11.5px] text-ink-400">
            {ad.adType === 'VIDEO' ? `${ad.adDuration}s video` : 'Image'} ·{' '}
            {ad.impressions.toLocaleString()} impr · {ad.clicks.toLocaleString()} clicks ·{' '}
            {ad.ctr.toFixed(2)}%
          </p>
          {ad.clickUrl && (
            <a href={ad.clickUrl} target="_blank" rel="noreferrer noopener"
              className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate text-[12.5px] text-cyan-300 underline hover:text-cyan-200">
              <Link2 className="size-3 shrink-0" />
              <span className="truncate">{ad.clickUrl}</span>
            </a>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {editable && (
            <>
              <Button size="sm" variant="quiet" disabled={busy} onClick={toggle}>
                {ad.status === 'ACTIVE' ? 'Switch off' : 'Switch on'}
              </Button>
              <Button size="sm" variant="quiet" icon={<Pencil className="size-4" />}
                onClick={() => setEditingAd(true)}>
                Edit
              </Button>
              <Button size="sm" variant="quiet" icon={<Trash2 className="size-4" />}
                onClick={() => setDeleting(true)} aria-label={`Delete ${ad.adTitle}`}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-ink-800 px-4 py-3.5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="letterboard text-ink-300">
            Targets {ad.placements.length > 0 && (
              <span className="font-mono text-ink-400">{ad.placements.length}</span>
            )}
          </p>
          {editable && (
            <Button size="sm" variant="quiet" icon={<Plus className="size-4" />}
              onClick={() => setAddingTarget(true)}>
              Add target
            </Button>
          )}
        </div>
        <PlacementChips
          actorId={actorId}
          ad={ad}
          campaign={campaign}
          editable={editable}
          onChanged={onChanged}
        />
      </div>

      <AdvertisementFormModal
        open={editingAd}
        actorId={actorId}
        campaignId={campaign.id}
        ad={ad}
        onClose={() => setEditingAd(false)}
        onSaved={() => { setEditingAd(false); onChanged() }}
      />

      <TargetPickerModal
        open={addingTarget}
        actorId={actorId}
        ad={ad}
        onClose={() => setAddingTarget(false)}
        onSaved={() => { setAddingTarget(false); onChanged() }}
      />

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete “${ad.adTitle}”?`}
        width="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setDeleting(false)}>Keep it</Button>
            <Button variant="danger" disabled={busy} onClick={async () => {
              setDeleting(false)
              await run(`${ad.adTitle} deleted`, () => ads.advertisements.remove(actorId, ad.id))
            }}>
              Delete advertisement
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          {ad.impressions > 0 ? (
            <>
              This advertisement has already been shown {ad.impressions.toLocaleString()} times, so
              it cannot be deleted — switching it off keeps its delivery record intact. The rest of
              the campaign is unaffected either way.
            </>
          ) : (
            <>
              Its targeting goes with it. Nothing else in this campaign changes — the other
              advertisements keep running.
            </>
          )}
        </p>
      </Modal>
    </li>
  )
}

/**
 * The advertisement form, for a new one and for an existing one alike.
 *
 * <p>The two differ only in whether the creative starts filled, and keeping them
 * as one form is what stops "add" and "edit" drifting into validating different
 * things about the same advertisement.
 */
function AdvertisementFormModal({
  open, actorId, campaignId, ad, onClose, onSaved,
}: {
  open: boolean
  actorId: number
  campaignId: number
  ad?: Advertisement
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [media, setMedia] = useState<{ url: string; type: AdType; filename: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [duration, setDuration] = useState('20')
  const [link, setLink] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(ad?.adTitle ?? '')
    setMedia(ad ? { url: ad.mediaUrl, type: ad.adType, filename: 'Current creative' } : null)
    setDuration(String(ad?.adDuration ?? 20))
    setLink(ad?.clickUrl ?? '')
    setErrors({})
  }, [open, ad])

  const pick = async (file: File) => {
    setUploading(true)
    setErrors((e) => ({ ...e, media: '' }))
    try {
      const stored = await ads.advertisements.uploadMedia(actorId, file)
      setMedia({ url: stored.mediaUrl, type: stored.adType, filename: stored.originalFilename })
      // The upload already knows what it handled; asking again is how a video
      // ends up recorded as an image.
      if (stored.adType === 'IMAGE') setDuration('0')
      toast({ title: `${stored.originalFilename} uploaded`, tone: 'ok' })
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        media: e instanceof ApiError ? e.message : 'The upload failed.',
      }))
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.adTitle = 'Give the advertisement a title.'
    if (!media) e.media = 'Upload the creative a viewer will see.'
    if (!link.trim()) e.clickUrl = 'A promotional link is required.'
    else if (!/^https?:\/\/.+/.test(link.trim())) {
      e.clickUrl = 'Enter a full URL, starting with http:// or https://'
    }
    if (media?.type === 'VIDEO' && (!duration.trim() || Number(duration) <= 0)) {
      e.adDuration = 'Say how long the video runs, in seconds.'
    }
    setErrors(e)
    if (Object.keys(e).length) return

    const body = {
      campaignId,
      adTitle: title.trim(),
      mediaUrl: media!.url,
      adType: media!.type,
      adDuration: Number(duration) || 0,
      clickUrl: link.trim(),
    }

    setSaving(true)
    try {
      if (ad) {
        await ads.advertisements.update(actorId, ad.id, body)
        toast({ title: `${body.adTitle} updated`, tone: 'ok' })
      } else {
        await ads.advertisements.create(actorId, body)
        toast({ title: `${body.adTitle} added — give it a target, then switch it on`, tone: 'ok' })
      }
      onSaved()
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError(0, 'Something went wrong.')
      setErrors(error.fields ?? {})
      toast({ title: error.message, tone: 'bad' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ad ? 'Edit advertisement' : 'Add an advertisement'}
      description={ad
        ? 'The targeting and the delivery already recorded stay as they are.'
        : 'It joins this campaign as a draft. Target it, then switch it on.'}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving || uploading}
            icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}>
            {ad ? 'Save changes' : 'Add advertisement'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Advertisement title" required error={errors.adTitle}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Autumn teaser — 20s cut" invalid={!!errors.adTitle} />
        </Field>

        <Field label="Creative" required error={errors.media ?? errors.mediaUrl}
          hint="MP4, WebM or MOV up to 50 MB — or PNG, JPEG, WebP or GIF">
          <label className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-left transition-colors',
            media ? 'border-success-500/50 bg-success-500/5' : 'border-ink-600 bg-ink-950 hover:border-violet-500/60',
          )}>
            <input type="file" className="sr-only" accept="video/*,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
            {uploading
              ? <Loader2 className="size-5 shrink-0 animate-spin text-violet-300" />
              : <Upload className="size-5 shrink-0 text-ink-300" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] text-ink-100">
                {uploading ? 'Uploading…' : media ? media.filename : 'Choose a file'}
              </span>
              <span className="block text-[12px] text-ink-400">
                {media ? `${media.type === 'VIDEO' ? 'Video' : 'Image'} — click to replace` : 'Video or image'}
              </span>
            </span>
            {media && (
              <span className="w-20 shrink-0 overflow-hidden rounded-xs border border-ink-700">
                <span className="relative block aspect-video">
                  <CreativePreview url={media.url} type={media.type} title={title} />
                </span>
              </span>
            )}
          </label>
        </Field>

        {media?.type !== 'IMAGE' && (
          <Field label="Duration" hint="Seconds" required={media?.type === 'VIDEO'}
            error={errors.adDuration}>
            <Input type="number" min="0" value={duration}
              onChange={(e) => setDuration(e.target.value)} invalid={!!errors.adDuration} />
          </Field>
        )}

        <Field label="Promotional link" required error={errors.clickUrl}
          hint="Where a click goes">
          <Input value={link} onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com/offer" invalid={!!errors.clickUrl} />
        </Field>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------- targeting */

/** One advertisement's targets, each removable and each editable in place. */
function PlacementChips({
  actorId, ad, campaign, editable, onChanged,
}: {
  actorId: number
  ad: Advertisement
  campaign: Campaign
  editable: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const [editing, setEditing] = useState<Placement | null>(null)
  const [busy, setBusy] = useState(false)

  if (ad.placements.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-400">
        No targets yet — with none, this advertisement is never delivered anywhere, and it cannot
        be switched on.
      </p>
    )
  }

  const detach = async (p: Placement) => {
    setBusy(true)
    try {
      await ads.targets.detach(actorId, p.id)
      toast({ title: `Stopped targeting ${p.targetLabel}` })
      onChanged()
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : 'Could not remove that target',
        tone: 'bad',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ad.placements.map((p) => (
          <span key={p.id}
            className="inline-flex items-center gap-1.5 rounded-sm border border-ink-600 bg-ink-900 px-2.5 py-1 text-[12.5px] text-ink-200">
            <span className="letterboard text-ink-400">
              {p.targetKind === 'video' ? 'TITLE' : 'CAT'}
            </span>
            {p.targetLabel}
            <span className="text-ink-400">·</span>
            <span className="text-ink-400">{SLOT_LABEL[p.slotPosition]}</span>
            {p.priority > 1 && (
              <span className="font-mono text-[11px] text-ink-400" title="Priority">
                P{p.priority}
              </span>
            )}
            {editable && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  aria-label={`Edit the ${p.targetLabel} placement`}
                  className="ml-0.5 rounded-xs p-0.5 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => detach(p)}
                  aria-label={`Stop targeting ${p.targetLabel}`}
                  className="rounded-xs p-0.5 text-ink-400 transition-colors hover:bg-danger-500/15 hover:text-danger-300"
                >
                  <X className="size-3" />
                </button>
              </>
            )}
          </span>
        ))}
      </div>

      <PlacementEditModal
        open={editing !== null}
        actorId={actorId}
        placement={editing}
        campaign={campaign}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); onChanged() }}
      />
    </>
  )
}

/**
 * Attach more targets to an advertisement that already exists.
 *
 * <p>Several can be chosen at once, and they are attached one at a time because
 * that is what the API offers. One failing does not undo the rest: what did
 * attach is reported, and what did not is said plainly, because silently
 * reporting "done" over a half-applied selection is worse than either.
 */
function TargetPickerModal({
  open, actorId, ad, onClose, onSaved,
}: {
  open: boolean
  actorId: number
  ad: Advertisement
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [chosen, setChosen] = useState<ChosenTarget[]>([])
  const [slot, setSlot] = useState<SlotPosition>(ad.placements[0]?.slotPosition ?? 'PREROLL')
  const [priority, setPriority] = useState('1')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const options = useApiData(
    () => ads.targets.options(actorId, search.trim() || undefined),
    [actorId, search],
    open,
  )

  useEffect(() => {
    if (!open) return
    setSearch('')
    setChosen([])
    setSlot(ad.placements[0]?.slotPosition ?? 'PREROLL')
    setPriority('1')
    setError('')
  }, [open, ad])

  // What is already targeted in this slot cannot be chosen again — the server
  // refuses it, and offering it only to refuse it is a worse way to say so.
  const taken = useMemo(() => {
    const keys = new Set<string>()
    for (const p of ad.placements) {
      if (p.slotPosition !== slot) continue
      keys.add(p.videoId != null ? `video:${p.videoId}` : `category:${p.categoryId}`)
    }
    return keys
  }, [ad.placements, slot])

  const toggle = (t: ChosenTarget) =>
    setChosen((list) =>
      list.some((x) => x.kind === t.kind && x.id === t.id)
        ? list.filter((x) => !(x.kind === t.kind && x.id === t.id))
        : [...list, t])

  const isChosen = (kind: 'video' | 'category', id: number) =>
    chosen.some((t) => t.kind === kind && t.id === id)

  const attach = async () => {
    if (chosen.length === 0) {
      setError('Choose at least one title or category to target.')
      return
    }
    setError('')
    setSaving(true)

    const failed: string[] = []
    let added = 0
    for (const target of chosen) {
      try {
        await ads.targets.attach(actorId, ad.id, {
          videoId: target.kind === 'video' ? target.id : null,
          categoryId: target.kind === 'category' ? target.id : null,
          slotPosition: slot,
          priority: Number(priority) || 1,
        })
        added += 1
      } catch (e) {
        failed.push(`${target.label} — ${e instanceof ApiError ? e.message : 'could not be added'}`)
      }
    }
    setSaving(false)

    if (added > 0) {
      toast({ title: added === 1 ? 'Target added' : `${added} targets added`, tone: 'ok' })
    }
    if (failed.length > 0) {
      setError(failed.join(' · '))
      onSaved()   // reload: some of it did land
      return
    }
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Target “${ad.adTitle}”`}
      description="Where this advertisement appears. A title and its category can both be targeted — a viewer still sees it once."
      width="lg"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={attach} disabled={saving}
            icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />}>
            {chosen.length > 1 ? `Add ${chosen.length} targets` : 'Add target'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slot" required hint="Where it appears">
            <Select value={slot} onChange={(e) => setSlot(e.target.value as SlotPosition)}>
              {(Object.keys(SLOT_LABEL) as SlotPosition[]).map((s) => (
                <option key={s} value={s}>{SLOT_LABEL[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" hint="1 is shown first">
            <Input type="number" min="1" value={priority}
              onChange={(e) => setPriority(e.target.value)} />
          </Field>
        </div>

        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search titles and categories" />

        {options.loading && !options.data ? (
          <p className="text-[12.5px] text-ink-400">Loading what can be targeted…</p>
        ) : options.error ? (
          <Failed error={options.error} onRetry={options.reload} />
        ) : (
          <div className="max-h-[42vh] space-y-5 overflow-y-auto pr-1">
            <TargetGroup
              heading="Categories"
              note="Every title in the category, including ones added later."
              options={(options.data?.categories ?? []).filter((o) => !taken.has(`category:${o.id}`))}
              isChosen={(id) => isChosen('category', id)}
              onToggle={(o) => toggle({ kind: 'category', id: o.id, label: o.label })}
            />
            <TargetGroup
              heading="Titles"
              note="One specific title."
              options={(options.data?.videos ?? []).filter((o) => !taken.has(`video:${o.id}`))}
              isChosen={(id) => isChosen('video', id)}
              onToggle={(o) => toggle({ kind: 'video', id: o.id, label: o.label })}
            />
          </div>
        )}

        {error && <p className="text-[12.5px] text-danger-400">{error}</p>}
      </div>
    </Modal>
  )
}

/**
 * Change a placement's slot, priority or window.
 *
 * <p>The target itself is not editable: a placement that changes what it points
 * at is a different placement, and the impressions recorded against the old one
 * would be attributed to the new target. Remove it and add the one meant instead.
 */
function PlacementEditModal({
  open, actorId, placement, campaign, onClose, onSaved,
}: {
  open: boolean
  actorId: number
  placement: Placement | null
  campaign: Campaign
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [slot, setSlot] = useState<SlotPosition>('PREROLL')
  const [priority, setPriority] = useState('1')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !placement) return
    setSlot(placement.slotPosition)
    setPriority(String(placement.priority))
    setFrom(dateOnly(placement.activeFrom))
    setTo(dateOnly(placement.activeTo))
    setError('')
  }, [open, placement])

  if (!placement) return null

  const save = async () => {
    if (from && to && new Date(to) <= new Date(from)) {
      setError('The placement must stop after it starts.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await ads.targets.retarget(actorId, placement.id, {
        slotPosition: slot,
        priority: Number(priority) || 1,
        activeFrom: from ? startOfDay(from) : null,
        activeTo: to ? endOfDay(to) : null,
      })
      toast({ title: `${placement.targetLabel} updated`, tone: 'ok' })
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Placement on ${placement.targetLabel}`}
      description="The delivery already recorded against this placement is kept."
      width="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}
            icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}>
            Save placement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-sm border border-danger-500/35 bg-danger-500/8 px-3 py-2 text-[12.5px] text-danger-300">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slot" required>
            <Select value={slot} onChange={(e) => setSlot(e.target.value as SlotPosition)}>
              {(Object.keys(SLOT_LABEL) as SlotPosition[]).map((s) => (
                <option key={s} value={s}>{SLOT_LABEL[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" hint="1 is shown first">
            <Input type="number" min="1" value={priority}
              onChange={(e) => setPriority(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Runs from">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Runs until">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-400">
          <CalendarRange className="mt-0.5 size-3.5 shrink-0" />
          A placement cannot outlive its campaign, which runs {dateOnly(campaign.startDate)} →{' '}
          {dateOnly(campaign.endDate)}. A wider window is trimmed to that.
        </p>
      </div>
    </Modal>
  )
}

/** Delivery split by video, category, device, slot and advertisement. */
function Breakdowns({ metrics }: { metrics: Metrics }) {
  const shown = metrics.breakdowns.filter((b) => b.rows.length > 0)
  if (shown.length === 0) return null

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {shown.map((b) => {
        const max = Math.max(...b.rows.map((r) => r.impressions), 1)
        return (
          <div key={b.dimension}>
            <p className="letterboard mb-2.5 text-ink-300">By {b.dimension}</p>
            <ul className="space-y-2.5">
              {b.rows.slice(0, 6).map((r) => (
                <li key={r.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] text-ink-100">{r.label}</span>
                    <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-ink-300">
                      {r.impressions.toLocaleString()} ·{' '}
                      <span className={r.ctr > 2 ? 'text-success-400' : ''}>{r.ctr.toFixed(2)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <div style={{ width: `${(r.impressions / max) * 100}%` }}
                      className="h-full bg-violet-500" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/* ==================================================== campaign performance */

export function CampaignPerformance() {
  return (
    <WithActor title="Campaign performance">
      {(actorId) => <PerformanceBody actorId={actorId} />}
    </WithActor>
  )
}

function PerformanceBody({ actorId }: { actorId: number }) {
  const nav = useNavigate()
  const { data, loading, error, reload } = useApiData<Campaign[]>(
    () => ads.campaigns.list(actorId), [actorId])

  if (loading && !data) return <Loading what="performance" />
  if (error) return <Failed error={error} onRetry={reload} />

  const all = data ?? []
  const withData = all.filter((c) => c.impressions > 0)
  const maxImp = Math.max(...withData.map((c) => c.impressions), 1)
  const totalImpressions = all.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = all.reduce((s, c) => s + c.clicks, 0)
  // Averaged over delivery, not over campaigns: a campaign with four impressions
  // must not weigh as much as one with four hundred thousand.
  const averageCtr = totalImpressions === 0 ? 0 : (totalClicks / totalImpressions) * 100

  if (all.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="size-7" />}
        title="Nothing to report yet"
        body="Performance appears here once a campaign has been delivered."
        action={<Button onClick={() => nav('/campaigns/new')}>New campaign</Button>}
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Total impressions', fmt(totalImpressions)],
          ['Total clicks', fmt(totalClicks)],
          ['Average CTR', `${averageCtr.toFixed(2)}%`],
          ['Running now', String(all.filter((c) => c.status === 'ACTIVE').length)],
        ].map(([l, v]) => (
          <div key={l} className="border-l border-ink-700 pl-3">
            <p className="letterboard text-ink-300">{l}</p>
            <p className="font-marquee mt-1 text-[26px] font-bold tabular-nums text-white">{v}</p>
          </div>
        ))}
      </div>

      {withData.length > 0 && (
        <div className="mt-9">
          <Section title="Delivery by campaign">
            <ul className="space-y-4">
              {[...withData].sort((a, b) => b.impressions - a.impressions).map((c) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link to={`/campaigns/${c.id}`}
                      className="font-marquee truncate text-[15px] font-bold text-white hover:text-violet-200">
                      {c.campaignName}
                    </Link>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-300">
                      {c.impressions.toLocaleString()} impr · {c.clicks.toLocaleString()} clicks ·{' '}
                      <span className={c.ctr > 2 ? 'text-success-400' : ''}>{c.ctr.toFixed(2)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-ink-800">
                    <div style={{ width: `${(c.impressions / maxImp) * 100}%` }}
                      className="h-full bg-violet-500" />
                    <div style={{ width: `${Math.min((c.clicks / maxImp) * 100 * 6, 100)}%` }}
                      className="h-full bg-cyan-400" />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-ink-300">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-violet-500" /> Impressions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-cyan-400" /> Clicks (×6 for legibility)
              </span>
            </p>
          </Section>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-ink-700 bg-ink-850">
        <Table labels={['Campaign', 'Status', 'Impressions', 'Clicks', 'CTR', 'Export']}>
          <thead>
            <tr>
              <Th>Campaign</Th><Th>Status</Th><Th numeric>Impressions</Th>
              <Th numeric>Clicks</Th><Th numeric>CTR</Th><Th>Export</Th>
            </tr>
          </thead>
          <tbody>
            {all.map((c) => (
              <Tr key={c.id} onClick={() => nav(`/campaigns/${c.id}`)}>
                <Td><span className="font-medium text-white">{c.campaignName}</span></Td>
                <Td><StatusBoard campaign={c} /></Td>
                <Td numeric>{c.impressions.toLocaleString()}</Td>
                <Td numeric>{c.clicks.toLocaleString()}</Td>
                <Td numeric>{c.ctr.toFixed(2)}%</Td>
                <Td>
                  <a
                    href={ads.campaigns.csvUrl(c.id)}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-300 hover:text-white"
                  >
                    <Download className="size-3.5" /> CSV
                  </a>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  )
}
