import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Plus, Megaphone, AlertTriangle, ArrowLeft, ArrowRight, Check, Upload, Link2,
  Play, Pause, Trash2, MousePointerClick, Eye, Target, CalendarRange,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Table, Th, Td, Tr, Tabs, Modal,
  EmptyState, Placeholder, Checkbox, useToast, Section, SearchInput,
} from '@/components/primitives'
import { Letterboard, Stations, Lightbox, PosterPlate } from '@/components/world'
import { BackOfHouse } from '@/components/Shell'
import { CAMPAIGNS, CATEGORIES, GENRES, VIDEOS, UNDECIDED, fmt, type Campaign } from '@/lib/data'
import { cn } from '@/lib/cn'

const EASE = [0.16, 1, 0.3, 1] as const

const STATUS_TONE: Record<Campaign['status'], 'live' | 'soon' | 'dead' | 'review' | 'neutral'> = {
  Active: 'live', Scheduled: 'soon', Expired: 'dead', Paused: 'review', Draft: 'neutral',
}

const ctr = (c: Campaign) => (c.impressions ? (c.clicks / c.impressions) * 100 : 0)

/* ========================================================== campaign list */

export function CampaignList() {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    let l = CAMPAIGNS
    if (tab === 'active') l = l.filter((c) => c.status === 'Active')
    if (tab === 'scheduled') l = l.filter((c) => c.status === 'Scheduled')
    if (tab === 'expired') l = l.filter((c) => c.status === 'Expired' || c.status === 'Paused')
    if (q.trim()) l = l.filter((c) => `${c.name} ${c.advertiser} ${c.id}`.toLowerCase().includes(q.toLowerCase()))
    return l
  }, [tab, q])

  const expired = CAMPAIGNS.filter((c) => c.status === 'Expired')

  return (
    <BackOfHouse
      title="Campaigns"
      actions={
        <Button variant="primary" size="sm" icon={<Plus className="size-4" />}
          onClick={() => (window.location.href = '/campaigns/new')}>
          New campaign
        </Button>
      }
    >
      {expired.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-sm border sm:flex-row sm:items-center border-warning-500/35 bg-warning-500/8 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-warning-400" />
          <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-200">
            <span className="font-medium text-warning-400">
              {expired.length} campaign{expired.length > 1 ? 's have' : ' has'} passed its end date.
            </span>{' '}
            Expired advertisements are already withheld from active display — remove them to clear
            the list.
          </p>
          <Button size="sm">Review expired</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: 'All', count: CAMPAIGNS.length },
              { id: 'active', label: 'Active', count: CAMPAIGNS.filter((c) => c.status === 'Active').length },
              { id: 'scheduled', label: 'Scheduled', count: CAMPAIGNS.filter((c) => c.status === 'Scheduled').length },
              { id: 'expired', label: 'Expired & paused', count: CAMPAIGNS.filter((c) => c.status === 'Expired' || c.status === 'Paused').length },
            ]}
          />
        </div>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a campaign" className="w-full sm:w-64" />
      </div>

      {list.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<Megaphone className="size-7" />} title="No campaigns here"
            body="Nothing matches this filter. Try another tab, or start a new campaign."
            action={<Button onClick={() => (window.location.href = '/campaigns/new')}>New campaign</Button>} />
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Campaign", "Status", "Placement", "Runs", "Targets", "Impressions", "Clicks", "CTR"]}>
            <thead>
              <tr>
                <Th>Campaign</Th><Th>Status</Th><Th>Placement</Th><Th>Runs</Th>
                <Th>Targets</Th><Th numeric>Impressions</Th><Th numeric>Clicks</Th><Th numeric>CTR</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <Tr key={c.id} onClick={() => (window.location.href = `/campaigns/${c.id}`)}>
                  <Td>
                    <span className="font-marquee block font-bold text-white">{c.name}</span>
                    <span className="block font-mono text-[11px] text-ink-300">{c.id} · {c.advertiser}</span>
                  </Td>
                  <Td><Letterboard tone={STATUS_TONE[c.status]}>{c.status.toUpperCase()}</Letterboard></Td>
                  <Td className="text-ink-300">{c.placement}</Td>
                  <Td>
                    <span className="font-mono text-[12px] tabular-nums text-ink-300">
                      {c.start} → {c.end}
                    </span>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {c.targets.map((t) => <Letterboard key={t}>{t}</Letterboard>)}
                    </span>
                  </Td>
                  <Td numeric>{c.impressions.toLocaleString()}</Td>
                  <Td numeric>{c.clicks.toLocaleString()}</Td>
                  <Td numeric className={cn(ctr(c) > 2 ? 'text-success-400' : 'text-ink-200')}>
                    {ctr(c).toFixed(2)}%
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-[12.5px] text-ink-300">
        What counts as a valid impression or click, and the formula behind CTR, are open decisions
        in the project documentation — the delivery figures shown here are provisional.
      </p>
    </BackOfHouse>
  )
}

/* =========================================================== new campaign */

const STEPS = ['Details', 'Creative', 'Targeting', 'Schedule', 'Live']

export function CampaignNew() {
  const nav = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [advertiser, setAdvertiser] = useState('')
  const [link, setLink] = useState('')
  const [placement, setPlacement] = useState('Pre-roll')
  const [targets, setTargets] = useState<string[]>([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const toggleTarget = (t: string) =>
    setTargets((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))

  const validateDetails = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Give the campaign a name you will recognise in the list.'
    if (!advertiser.trim()) e.advertiser = 'Name the advertiser this runs for.'
    setErrors(e)
    if (!Object.keys(e).length) setStep(1)
  }

  const validateCreative = () => {
    const e: Record<string, string> = {}
    if (!link.trim()) e.link = 'A promotional link is required.'
    else if (!/^https?:\/\/.+/.test(link)) e.link = 'Enter a full URL, starting with http:// or https://'
    setErrors(e)
    if (!Object.keys(e).length) setStep(2)
  }

  const validateTargeting = () => {
    const e: Record<string, string> = {}
    if (targets.length === 0) e.targets = 'Choose at least one category or genre to target.'
    setErrors(e)
    if (!Object.keys(e).length) setStep(3)
  }

  /** UC-FR5-01 extension 6a — reject an invalid schedule. */
  const scheduleError =
    start && end && new Date(end) <= new Date(start)
      ? 'The end date must fall after the start date.'
      : ''

  const validateSchedule = () => {
    const e: Record<string, string> = {}
    if (!start) e.start = 'Set the date the campaign starts running.'
    if (!end) e.end = 'Set the date it stops.'
    if (scheduleError) e.end = scheduleError
    setErrors(e)
    if (!Object.keys(e).length) {
      setStep(4)
      toast({ title: 'Campaign confirmed and scheduled', tone: 'ok' })
    }
  }

  return (
    <BackOfHouse title="New campaign">
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
              <Field label="Placement" required hint="Where the advertisement appears">
                <Select value={placement} onChange={(e) => setPlacement(e.target.value)}>
                  <option>Pre-roll</option>
                  <option>Mid-roll</option>
                  <option>Lobby standee</option>
                </Select>
              </Field>
              <p className="text-[12.5px] text-ink-300">
                Which placement types ship first is an open decision: <Placeholder>{UNDECIDED}</Placeholder>
              </p>
              <Nav onNext={validateDetails} nextLabel="Continue to creative" />
            </Panel>
          )}

          {step === 1 && (
            <Panel>
              <Field label="Advertisement media" hint="Video or image">
                <button className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-ink-600 bg-ink-950 px-6 py-10 text-center transition-colors hover:border-violet-500/60">
                  <Upload className="size-7 text-ink-300" />
                  <p className="mt-3 text-[14px] font-medium text-white">Upload creative</p>
                  <p className="mt-1 text-[12.5px] text-ink-300">
                    Accepted ad formats and sizes are not yet defined.
                  </p>
                </button>
              </Field>

              <Field label="Promotional link" required error={errors.link}
                hint="Where a click sends the viewer">
                <Input value={link} onChange={(e) => setLink(e.target.value)}
                  placeholder="https://example.com/campaign" invalid={!!errors.link} />
              </Field>

              <div>
                <p className="letterboard mb-2 text-ink-300">Preview — as a viewer sees it</p>
                <Lightbox>
                  <div className="relative aspect-video">
                    <PosterPlate title={name || 'Your campaign'} seed={name.length + 4} compact lettering={false} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-950/65 text-center">
                      <Letterboard tone="held">Advertisement</Letterboard>
                      <p className="font-marquee text-[20px] font-bold text-white">
                        {name || 'Your campaign'}
                      </p>
                      <p className="text-[12px] text-ink-300">{advertiser || 'Advertiser'}</p>
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
                <p className="mb-2 flex items-baseline gap-2 text-[13px] font-medium text-ink-150">
                  Target categories and genres <span className="text-danger-400">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...CATEGORIES, ...GENRES].map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTarget(t)}
                      aria-pressed={targets.includes(t)}
                      className={cn(
                        'rounded-sm border px-3 py-1.5 text-[13px] transition-colors',
                        targets.includes(t)
                          ? 'border-violet-400 bg-violet-500/18 text-violet-100'
                          : 'border-ink-600 bg-ink-850 text-ink-200 hover:border-ink-500',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {errors.targets && <p className="mt-2 text-[12px] text-danger-400">{errors.targets}</p>}
              </div>

              <div className="rounded-sm border border-ink-700 bg-ink-850 px-4 py-3">
                <p className="flex items-center gap-2 text-[13.5px] text-ink-200">
                  <Target className="size-4 text-cyan-400" />
                  {targets.length === 0
                    ? 'No targets chosen — this campaign would not be delivered anywhere.'
                    : `Reaches ${VIDEOS.filter((v) => targets.includes(v.category) || targets.includes(v.genre)).length} titles currently in the programme.`}
                </p>
              </div>

              <Nav onBack={() => setStep(1)} onNext={validateTargeting} nextLabel="Continue to schedule" />
            </Panel>
          )}

          {step === 3 && (
            <Panel>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Start date" required error={errors.start}>
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} invalid={!!errors.start} />
                </Field>
                <Field label="End date" required error={errors.end}>
                  <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} invalid={!!errors.end} />
                </Field>
              </div>

              {scheduleError && (
                <div className="flex items-start gap-2.5 rounded-sm border border-danger-500/35 bg-danger-500/8 px-4 py-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-400" />
                  <p className="text-[13.5px] text-ink-200">{scheduleError}</p>
                </div>
              )}

              <div className="rounded-sm border border-ink-700 bg-ink-850 px-4 py-3">
                <p className="flex items-center gap-2 text-[13.5px] text-ink-200">
                  <CalendarRange className="size-4 text-cyan-400" />
                  The advertisement is shown only between these dates. After the end date it stops
                  being delivered automatically.
                </p>
              </div>

              <Checkbox checked onChange={() => {}} label="Deactivate automatically once the end date passes" />

              <Nav onBack={() => setStep(2)} onNext={validateSchedule} nextLabel="Confirm campaign" primary />
            </Panel>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="rounded-lg border border-success-500/35 bg-success-500/6 p-8 text-center">
              <Check className="mx-auto size-9 text-success-400" />
              <h2 className="font-marquee mt-4 text-[24px] font-bold text-white">{name} is scheduled</h2>
              <p className="mx-auto mt-2 max-w-[50ch] text-[14px] leading-relaxed text-ink-300">
                It runs from {start} to {end} against {targets.length} target
                {targets.length === 1 ? '' : 's'}, and stops on its own afterwards.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <Button variant="primary" onClick={() => nav('/campaigns')}>Back to campaigns</Button>
                <Button onClick={() => nav('/campaigns/performance')}>See performance</Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </BackOfHouse>
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
  onBack, onNext, nextLabel, primary,
}: { onBack?: () => void; onNext: () => void; nextLabel: string; primary?: boolean }) {
  return (
    <div className="flex justify-between pt-2">
      {onBack ? (
        <Button variant="quiet" icon={<ArrowLeft className="size-4" />} onClick={onBack}>Back</Button>
      ) : <span />}
      <Button variant={primary ? 'primary' : 'primary'} icon={<ArrowRight className="size-4" />} onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  )
}

/* ======================================================== campaign detail */

export function CampaignDetail() {
  const { id } = useParams()
  const c = CAMPAIGNS.find((x) => x.id === id)
  const toast = useToast()
  const [removing, setRemoving] = useState(false)

  if (!c) {
    return (
      <BackOfHouse title="Campaign not found">
        <EmptyState title="No such campaign" body="That campaign does not exist or has been removed."
          action={<Button onClick={() => (window.location.href = '/campaigns')}>Back to campaigns</Button>} />
      </BackOfHouse>
    )
  }

  const expired = c.status === 'Expired'

  return (
    <BackOfHouse
      title={c.name}
      actions={
        <>
          {c.status === 'Active' ? (
            <Button size="sm" icon={<Pause className="size-4" />} onClick={() => toast({ title: 'Campaign paused' })}>
              Pause
            </Button>
          ) : c.status === 'Paused' ? (
            <Button size="sm" icon={<Play className="size-4" />} onClick={() => toast({ title: 'Campaign resumed', tone: 'ok' })}>
              Resume
            </Button>
          ) : null}
          <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setRemoving(true)}>
            Remove
          </Button>
        </>
      }
    >
      <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-white">
        <ArrowLeft className="size-4" /> All campaigns
      </Link>

      {expired && (
        <div className="mt-4 flex items-start gap-2.5 rounded-sm border border-warning-500/35 bg-warning-500/8 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-400" />
          <p className="text-[13.5px] leading-relaxed text-ink-200">
            This campaign ended on {c.end} and is no longer being delivered. Its recorded
            performance is kept for reporting.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Letterboard tone={STATUS_TONE[c.status]}>{c.status.toUpperCase()}</Letterboard>
            <Letterboard>{c.placement}</Letterboard>
            <Letterboard>{c.media}</Letterboard>
          </div>

          <dl className="mt-6 grid gap-5 border-y border-ink-800 py-5 sm:grid-cols-3">
            {[
              ['Advertiser', c.advertiser],
              ['Runs', `${c.start} → ${c.end}`],
              ['Reference', c.id],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="letterboard text-ink-300">{k}</dt>
                <dd className="mt-1 font-mono text-[13px] tabular-nums text-ink-100">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <p className="letterboard mb-2.5 text-ink-300">Targets</p>
            <div className="flex flex-wrap gap-2">
              {c.targets.map((t) => <Letterboard key={t}>{t}</Letterboard>)}
            </div>
          </div>

          <div className="mt-6">
            <p className="letterboard mb-2 text-ink-300">Promotional link</p>
            <a href={c.link} className="inline-flex items-center gap-1.5 text-[13.5px] text-cyan-300 underline hover:text-cyan-200">
              <Link2 className="size-3.5" /> {c.link}
            </a>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              [<Eye key="e" className="size-4" />, 'Impressions', c.impressions.toLocaleString()],
              [<MousePointerClick key="c" className="size-4" />, 'Clicks', c.clicks.toLocaleString()],
              [<Target key="t" className="size-4" />, 'CTR', `${ctr(c).toFixed(2)}%`],
            ].map(([icon, label, value]) => (
              <div key={label as string} className="rounded-lg border border-ink-700 bg-ink-850 p-4">
                <p className="letterboard flex items-center gap-1.5 text-ink-300">{icon}{label}</p>
                <p className="font-marquee mt-1.5 text-[24px] font-bold tabular-nums text-white">{value}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-300">
            What counts as a valid impression or click, and the exact performance formulas, are
            open decisions in the project documentation.
          </p>
        </div>

        <aside>
          <p className="letterboard mb-2 text-ink-300">Creative</p>
          <Lightbox>
            <div className="relative aspect-video">
              <PosterPlate title={c.name} seed={c.name.length + 3} compact lettering={false} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink-950/60 text-center">
                <Letterboard tone="held">Advertisement</Letterboard>
                <p className="font-marquee text-[17px] font-bold text-white">{c.name}</p>
              </div>
            </div>
          </Lightbox>
          <Button size="sm" className="mt-2.5 w-full" icon={<Upload className="size-4" />}>Replace creative</Button>
        </aside>
      </div>

      <Modal
        open={removing}
        onClose={() => setRemoving(false)}
        title={`Remove “${c.name}”?`}
        width="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setRemoving(false)}>Keep it</Button>
            <Button variant="danger" onClick={() => { setRemoving(false); toast({ title: 'Campaign removed', tone: 'bad' }) }}>
              Remove campaign
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          The advertisement stops being delivered immediately. Recorded impressions and clicks are
          kept so past reporting stays accurate.
        </p>
      </Modal>
    </BackOfHouse>
  )
}

/* ==================================================== campaign performance */

export function CampaignPerformance() {
  const withData = CAMPAIGNS.filter((c) => c.impressions > 0)
  const maxImp = Math.max(...withData.map((c) => c.impressions))

  return (
    <BackOfHouse title="Campaign performance">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Total impressions', fmt(CAMPAIGNS.reduce((s, c) => s + c.impressions, 0))],
          ['Total clicks', fmt(CAMPAIGNS.reduce((s, c) => s + c.clicks, 0))],
          ['Average CTR', `${(withData.reduce((s, c) => s + ctr(c), 0) / withData.length).toFixed(2)}%`],
          ['Running now', String(CAMPAIGNS.filter((c) => c.status === 'Active').length)],
        ].map(([l, v]) => (
          <div key={l} className="border-l border-ink-700 pl-3">
            <p className="letterboard text-ink-300">{l}</p>
            <p className="font-marquee mt-1 text-[26px] font-bold tabular-nums text-white">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-9">
        <Section title="Delivery by campaign">
          <ul className="space-y-4">
            {[...withData].sort((a, b) => b.impressions - a.impressions).map((c) => (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <Link to={`/campaigns/${c.id}`} className="font-marquee truncate text-[15px] font-bold text-white hover:text-violet-200">
                    {c.name}
                  </Link>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-300">
                    {c.impressions.toLocaleString()} impr · {c.clicks.toLocaleString()} clicks ·{' '}
                    <span className={ctr(c) > 2 ? 'text-success-400' : ''}>{ctr(c).toFixed(2)}%</span>
                  </span>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-ink-800">
                  <div
                    style={{ width: `${(c.impressions / maxImp) * 100}%` }}
                    className="h-full bg-violet-500"
                  />
                  <div
                    style={{ width: `${(c.clicks / maxImp) * 100 * 6}%` }}
                    className="h-full bg-cyan-400"
                  />
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

      <p className="mt-8 text-[12.5px] text-ink-300">
        What counts as a valid impression or click, and the formula behind CTR, are open decisions
        in the project documentation — every figure below is provisional.
      </p>

      <div className="mt-6 rounded-lg border border-ink-700 bg-ink-850">
        <Table labels={["Campaign", "Status", "Impressions", "Clicks", "CTR", "Placement"]}>
          <thead>
            <tr>
              <Th>Campaign</Th><Th>Status</Th><Th numeric>Impressions</Th>
              <Th numeric>Clicks</Th><Th numeric>CTR</Th><Th>Placement</Th>
            </tr>
          </thead>
          <tbody>
            {CAMPAIGNS.map((c) => (
              <Tr key={c.id} onClick={() => (window.location.href = `/campaigns/${c.id}`)}>
                <Td><span className="font-medium text-white">{c.name}</span></Td>
                <Td><Letterboard tone={STATUS_TONE[c.status]}>{c.status.toUpperCase()}</Letterboard></Td>
                <Td numeric>{c.impressions.toLocaleString()}</Td>
                <Td numeric>{c.clicks.toLocaleString()}</Td>
                <Td numeric>{ctr(c).toFixed(2)}%</Td>
                <Td className="text-ink-300">{c.placement}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </BackOfHouse>
  )
}
