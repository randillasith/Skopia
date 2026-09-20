import { useState } from 'react'
import { Flag, Plus } from 'lucide-react'
import { Button, EmptyState, Tabs, Modal } from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { FrontOfHouse } from '@/components/Shell'
import { ReportModal } from '@/routes/viewer'
import { REPORTS, byId, type ReportStatus } from '@/lib/data'

export const REPORT_TONE: Record<ReportStatus, 'live' | 'ok' | 'review' | 'neutral' | 'bad'> = {
  Submitted: 'review',
  'Under review': 'live',
  'Needs info': 'bad',
  Resolved: 'ok',
  Closed: 'neutral',
}

export function MyReports() {
  const mine = REPORTS.filter((r) => r.reporter === 'you')
  const [tab, setTab] = useState('open')
  const [filing, setFiling] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const shown =
    tab === 'open'
      ? mine.filter((r) => r.status !== 'Resolved' && r.status !== 'Closed')
      : tab === 'closed'
        ? mine.filter((r) => r.status === 'Resolved' || r.status === 'Closed')
        : mine

  const detail = mine.find((r) => r.id === open)

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-marquee text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
              My reports
            </h1>
            <p className="mt-2 text-[15px] text-ink-300">
              Everything you have reported, and where it got to.
            </p>
          </div>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setFiling(true)}>
            New report
          </Button>
        </div>

        <div className="mt-6">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'open', label: 'Open', count: mine.filter((r) => r.status !== 'Resolved' && r.status !== 'Closed').length },
              { id: 'closed', label: 'Closed', count: mine.filter((r) => r.status === 'Resolved' || r.status === 'Closed').length },
              { id: 'all', label: 'All', count: mine.length },
            ]}
          />
        </div>

        {shown.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Flag className="size-7" />}
              title="No reports here"
              body="When you report a title or a playback problem, it appears here with a status you can follow."
              action={<Button onClick={() => setFiling(true)}>File a report</Button>}
            />
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-ink-800">
            {shown.map((r) => {
              const target = r.target ? byId(r.target) : undefined
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setOpen(r.id)}
                    className="flex w-full items-start gap-4 py-4 text-left transition-colors hover:bg-ink-850/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] tabular-nums text-ink-300">{r.id}</span>
                        <Letterboard tone={REPORT_TONE[r.status]}>{r.status.toUpperCase()}</Letterboard>
                      </div>
                      <p className="mt-1.5 text-[15px] font-medium text-white">{r.subject}</p>
                      <p className="mt-0.5 text-[13px] text-ink-300">
                        {r.type}
                        {target && ` · ${target.title}`} · submitted {r.submitted}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ReportModal open={filing} onClose={() => setFiling(false)} />

      <Modal
        open={!!detail}
        onClose={() => setOpen(null)}
        title={detail?.subject ?? ''}
        description={detail ? `${detail.id} · ${detail.type}` : undefined}
        footer={<Button variant="quiet" onClick={() => setOpen(null)}>Close</Button>}
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Letterboard tone={REPORT_TONE[detail.status]}>{detail.status.toUpperCase()}</Letterboard>
              {detail.assignee && <Letterboard>{`Assigned · ${detail.assignee}`}</Letterboard>}
            </div>

            <div>
              <p className="letterboard mb-1.5 text-ink-300">What you reported</p>
              <p className="text-[14px] leading-relaxed text-ink-200">{detail.detail}</p>
            </div>

            <div>
              <p className="letterboard mb-2.5 text-ink-300">History</p>
              <ol className="space-y-3 border-l border-ink-700 pl-4">
                {detail.history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-violet-500 ring-2 ring-ink-850" />
                    <p className="text-[13.5px] text-ink-100">{h.what}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-300">
                      {h.at} · {h.who}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </FrontOfHouse>
  )
}
