/**
 * FR5 — the advertising console.
 *
 * Every figure and every status on these screens comes from the API. Nothing is
 * recomputed in the browser: a campaign already knows whether it has expired, and
 * CTR is already a number, because two definitions of the same percentage is how a
 * dashboard and a report end up disagreeing about the same campaign.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Plus, Megaphone, AlertTriangle, ArrowLeft, ArrowRight, Check, Upload, Link2,
  Play, Pause, MousePointerClick, Eye, Target, CalendarRange, Archive,
  Download, Loader2, RefreshCw, X,
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
  type Advertisement, type Campaign, type CampaignStatus, type Metrics,
  type SlotPosition, type TargetOption,
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
  const firstAd = adverts.data?.[0]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-white">
          <ArrowLeft className="size-4" /> All campaigns
        </Link>
        <div className="flex flex-wrap gap-2">
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
          {c.status !== 'ARCHIVED' && (
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
            {firstAd && <Letterboard>{SLOT_LABEL[firstAd.placements[0]?.slotPosition ?? 'PREROLL']}</Letterboard>}
            {firstAd && <Letterboard>{firstAd.adType === 'VIDEO' ? 'Video' : 'Image'}</Letterboard>}
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

          <div className="mt-6">
            <p className="letterboard mb-2.5 text-ink-300">Targets</p>
            {adverts.loading && !adverts.data ? (
              <p className="text-[12.5px] text-ink-400">Loading…</p>
            ) : (
              <TargetList
                actorId={actorId}
                adverts={adverts.data ?? []}
                editable={c.status !== 'ARCHIVED'}
                onChanged={reloadAll}
              />
            )}
          </div>

          {firstAd?.clickUrl && (
            <div className="mt-6">
              <p className="letterboard mb-2 text-ink-300">Promotional link</p>
              <a href={firstAd.clickUrl} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-[13.5px] text-cyan-300 underline hover:text-cyan-200">
                <Link2 className="size-3.5" /> {firstAd.clickUrl}
              </a>
            </div>
          )}

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

          {adverts.data && adverts.data.length > 0 && (
            <div className="mt-8">
              <Section title="Advertisements">
                <ul className="space-y-2.5">
                  {adverts.data.map((ad) => (
                    <AdvertisementRow key={ad.id} actorId={actorId} ad={ad} onChanged={reloadAll} />
                  ))}
                </ul>
              </Section>
            </div>
          )}
        </div>

        <aside>
          <p className="letterboard mb-2 text-ink-300">Creative</p>
          <Lightbox>
            <div className="relative aspect-video">
              <CreativePreview url={firstAd?.mediaUrl} type={firstAd?.adType} title={c.campaignName} />
              <div className="absolute inset-x-0 top-0 flex justify-start p-3">
                <Letterboard tone="held">Advertisement</Letterboard>
              </div>
            </div>
          </Lightbox>
        </aside>
      </div>

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
          The advertisement stops being delivered immediately. Recorded impressions and clicks are
          kept so past reporting stays accurate — which is why this archives rather than deletes.
        </p>
      </Modal>
    </>
  )
}

function TargetList({
  actorId, adverts, editable, onChanged,
}: {
  actorId: number
  adverts: Advertisement[]
  editable: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const placements = adverts.flatMap((ad) => ad.placements)

  if (placements.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-400">
        No targets yet — with none, this campaign is never delivered anywhere.
      </p>
    )
  }

  const detach = async (placementId: number, label: string) => {
    try {
      await ads.targets.detach(actorId, placementId)
      toast({ title: `Stopped targeting ${label}` })
      onChanged()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Could not remove that target', tone: 'bad' })
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {placements.map((p) => (
        <span key={p.id}
          className="inline-flex items-center gap-1.5 rounded-sm border border-ink-600 bg-ink-850 px-2.5 py-1 text-[12.5px] text-ink-200">
          <span className="letterboard text-ink-400">{p.targetKind === 'video' ? 'TITLE' : 'CAT'}</span>
          {p.targetLabel}
          <span className="text-ink-400">·</span>
          <span className="text-ink-400">{SLOT_LABEL[p.slotPosition]}</span>
          {editable && (
            <button
              type="button"
              onClick={() => detach(p.id, p.targetLabel)}
              aria-label={`Stop targeting ${p.targetLabel}`}
              className="ml-0.5 rounded-xs p-0.5 text-ink-400 transition-colors hover:bg-danger-500/15 hover:text-danger-300"
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function AdvertisementRow({
  actorId, ad, onChanged,
}: { actorId: number; ad: Advertisement; onChanged: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      if (ad.status === 'ACTIVE') {
        await ads.advertisements.deactivate(actorId, ad.id)
        toast({ title: `${ad.adTitle} switched off` })
      } else {
        await ads.advertisements.activate(actorId, ad.id)
        toast({ title: `${ad.adTitle} switched on`, tone: 'ok' })
      }
      onChanged()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'That did not work', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-sm border border-ink-700 bg-ink-850 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-white">{ad.adTitle}</p>
        <p className="font-mono text-[11.5px] text-ink-400">
          {ad.adType === 'VIDEO' ? `${ad.adDuration}s video` : 'Image'} ·{' '}
          {ad.impressions.toLocaleString()} impr · {ad.clicks.toLocaleString()} clicks ·{' '}
          {ad.ctr.toFixed(2)}%
        </p>
      </div>
      <Letterboard tone={ad.status === 'ACTIVE' ? (ad.servable ? 'live' : 'review') : 'neutral'}>
        {ad.status}
      </Letterboard>
      {ad.status === 'ACTIVE' && !ad.servable && (
        <span className="text-[12px] text-ink-400" title="Switched on, but its campaign is not running">
          not running
        </span>
      )}
      <Button size="sm" variant="quiet" disabled={busy} onClick={toggle}>
        {ad.status === 'ACTIVE' ? 'Switch off' : 'Switch on'}
      </Button>
    </li>
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
