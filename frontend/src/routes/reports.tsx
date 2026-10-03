import { useCallback, useEffect, useState } from 'react'
import { Flag, Plus } from 'lucide-react'
import { Button, EmptyState, Tabs, Modal } from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { FrontOfHouse, useSession } from '@/components/Shell'
import { Resolve } from '@/components/Loading'
import { ReportModal } from '@/routes/viewer'
import { ApiError } from '@/lib/api'
import { actorId as actorIdOf } from '@/lib/session'
import {
  reports, isClosed, REPORT_STATUS_LABEL, REPORT_STATUS_TONE, REPORT_TYPE_LABEL,
  type ServerReport,
} from '@/lib/reports'

/**
 * The reports this account has filed.
 *
 * Reports belong to an account by definition — the reason to keep one is to
 * follow it — so a guest is told to sign in rather than shown an empty list that
 * suggests they have never reported anything.
 */
export function MyReports() {
  const { viewer, resolving } = useSession()
  const actor = actorIdOf(viewer)
  const [mine, setMine] = useState<ServerReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [tab, setTab] = useState('open')
  const [filing, setFiling] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (resolving) return
    if (actor == null) {
      setMine([])
      setLoading(false)
      return
    }
    const abort = new AbortController()
    setLoading(true)
    reports
      .forViewer(actor, abort.signal)
      .then((rows) => {
        setMine(rows)
        setError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not load your reports.')
        setMine([])
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [actor, resolving, nonce])

  const openCount = mine.filter((r) => !isClosed(r.status)).length
  const shown =
    tab === 'open' ? mine.filter((r) => !isClosed(r.status))
    : tab === 'closed' ? mine.filter((r) => isClosed(r.status))
    : mine

  const detail = mine.find((r) => r.id === open)

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-marquee text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.03em] text-fg">
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
              { id: 'open', label: 'Open', count: openCount },
              { id: 'closed', label: 'Closed', count: mine.length - openCount },
              { id: 'all', label: 'All', count: mine.length },
            ]}
          />
        </div>

        {loading || error ? (
          <div className="mt-8">
            <Resolve loading={loading} error={error} onRetry={refresh} what="Reading your reports">
              {null}
            </Resolve>
          </div>
        ) : shown.length === 0 ? (
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
            {shown.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setOpen(r.id)}
                  className="flex w-full items-start gap-4 py-4 text-left transition-colors hover:bg-ink-850/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] tabular-nums text-ink-300">
                        RPT-{String(r.id).padStart(4, '0')}
                      </span>
                      <Letterboard tone={REPORT_STATUS_TONE[r.status]}>
                        {REPORT_STATUS_LABEL[r.status].toUpperCase()}
                      </Letterboard>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[15px] font-medium text-fg">
                      {r.details}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-300">
                      {REPORT_TYPE_LABEL[r.type]}
                      {r.contentReference && ` · ${r.contentReference}`} · submitted{' '}
                      {r.createdAt?.slice(0, 10)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReportModal open={filing} onClose={() => setFiling(false)} onFiled={refresh} />

      <Modal
        open={!!detail}
        onClose={() => setOpen(null)}
        title={detail ? REPORT_TYPE_LABEL[detail.type] : ''}
        description={detail ? `RPT-${String(detail.id).padStart(4, '0')}` : undefined}
        footer={<Button variant="quiet" onClick={() => setOpen(null)}>Close</Button>}
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Letterboard tone={REPORT_STATUS_TONE[detail.status]}>
                {REPORT_STATUS_LABEL[detail.status].toUpperCase()}
              </Letterboard>
              {detail.contentReference && <Letterboard>{detail.contentReference}</Letterboard>}
            </div>

            <div>
              <p className="letterboard mb-1.5 text-ink-300">What you reported</p>
              <p className="text-[14px] leading-relaxed text-ink-200">{detail.details}</p>
            </div>

            {/* The API records when a report was filed and when it last moved,
                but not the steps in between, so only those two are shown. */}
            <div>
              <p className="letterboard mb-2.5 text-ink-300">History</p>
              <ol className="space-y-3 border-l border-ink-700 pl-4">
                <li className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-violet-500 ring-2 ring-ink-850" />
                  <p className="text-[13.5px] text-ink-100">Submitted</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-300">
                    {detail.createdAt?.replace('T', ' ').slice(0, 16)}
                  </p>
                </li>
                {detail.updatedAt && detail.updatedAt !== detail.createdAt && (
                  <li className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-violet-500 ring-2 ring-ink-850" />
                    <p className="text-[13.5px] text-ink-100">
                      Moved to {REPORT_STATUS_LABEL[detail.status]}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-300">
                      {detail.updatedAt.replace('T', ' ').slice(0, 16)}
                    </p>
                  </li>
                )}
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </FrontOfHouse>
  )
}
