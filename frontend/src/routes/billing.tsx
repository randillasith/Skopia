import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check, CreditCard, Download, ShieldCheck, AlertTriangle, ArrowLeft,
  ArrowUpRight, Receipt, X,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Table, Th, Td, Tr, Modal, Placeholder, Working, useToast,
} from '@/components/primitives'
import { Letterboard, Stations } from '@/components/world'
import { FrontOfHouse } from '@/components/Shell'
import { PLANS, PAYMENTS, UNDECIDED } from '@/lib/data'
import { cn } from '@/lib/cn'

/* ================================================================== plans */

export function Plans() {
  const nav = useNavigate()
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-marquee text-[clamp(2rem,4.5vw,2.9rem)] font-extrabold tracking-[-0.03em] text-white">
          Passes
        </h1>
        <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-ink-300">
          Browsing is free and always will be. A pass opens the premium programme and takes the
          advertising out.
        </p>

        <div className="mt-4 flex items-start gap-2.5 rounded-sm border border-warning-500/30 bg-warning-500/8 px-4 py-3 text-[13.5px] leading-relaxed text-warning-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Plan names, prices, durations and entitlements are all open decisions in the project
            documentation. The names below are working choices and the figures are placeholders —
            none of it is settled.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                'flex flex-col rounded-lg border p-6',
                i === 1
                  ? 'border-violet-500/50 bg-violet-500/6 shadow-[0_0_0_1px_rgb(117_89_255/0.18)]'
                  : 'border-ink-700 bg-ink-850',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-marquee text-[21px] font-bold text-white">
                  <Working>{p.name}</Working>
                </h2>
                {p.current && <Letterboard tone="ok">Current</Letterboard>}
                {i === 1 && !p.current && <Letterboard tone="soon">Most chosen</Letterboard>}
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <Placeholder>{`Price ${UNDECIDED}`}</Placeholder>
              </div>
              <p className="mt-1.5 text-[12.5px] text-ink-300">Billing period not yet decided</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {p.entitlements.map((e) => (
                  <li key={e} className="flex gap-2.5 text-[14px] text-ink-200">
                    <Check className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                    {e}
                  </li>
                ))}
              </ul>

              <Button
                variant={i === 1 ? 'primary' : 'secondary'}
                className="mt-6 w-full"
                disabled={p.current}
                onClick={() => nav(`/checkout?plan=${p.id}`)}
              >
                {p.current ? 'Your current pass' : `Choose ${p.name}`}
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 flex items-center gap-2 text-[13px] text-ink-300">
          <ShieldCheck className="size-4" />
          Payments are handled by an external gateway. The provider has not been selected yet.
        </p>
      </div>
    </FrontOfHouse>
  )
}

/* =============================================================== checkout */

const STEPS = ['Choose', 'Details', 'Authorise', 'Confirmed']

export function Checkout() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const plan = PLANS.find((p) => p.id === params.get('plan')) ?? PLANS[1]
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)

  const authorise = () => {
    setBusy(true)
    setStep(2)
    window.setTimeout(() => {
      setBusy(false)
      nav('/checkout/result?status=ok')
    }, 1400)
  }

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/plans" className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-white">
          <ArrowLeft className="size-4" /> Back to passes
        </Link>

        <h1 className="font-marquee mt-4 text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          Claim the <Working>{plan.name}</Working>
        </h1>

        <div className="mt-6">
          <Stations steps={STEPS} active={step} pointOfNoReturn={2} />
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-300">
            <AlertTriangle className="size-3.5 text-warning-400" />
            Once you authorise, the payment is sent to the gateway and cannot be recalled from here.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_260px]">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              authorise()
            }}
          >
            <h2 className="font-marquee text-[17px] font-bold text-white">Payment details</h2>

            <div className="rounded-sm border border-ink-700 bg-ink-850 px-4 py-3 text-[13px] leading-relaxed text-ink-300">
              This is a prototype. Do not enter real card details — nothing here is connected to a
              payment gateway, and the provider has not been chosen yet.
            </div>

            <Field label="Cardholder name" required>
              <Input placeholder="Name as printed on the card" autoComplete="cc-name" />
            </Field>
            <Field label="Card number" required hint="Prototype — use any digits">
              <Input inputMode="numeric" placeholder="0000 0000 0000 0000" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Expiry" required><Input placeholder="MM / YY" /></Field>
              <Field label="Security code" required><Input placeholder="123" /></Field>
            </div>
            <Field label="Country">
              <Select defaultValue="LK">
                <option value="LK">Sri Lanka</option>
                <option value="other">Elsewhere</option>
              </Select>
            </Field>

            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              {busy ? 'Contacting the gateway…' : 'Authorise payment'}
            </Button>
          </form>

          <aside className="h-fit rounded-lg border border-ink-700 bg-ink-850 p-5">
            <p className="letterboard text-ink-300">Summary</p>
            <p className="font-marquee mt-2 text-[19px] font-bold text-white">
              <Working>{plan.name}</Working>
            </p>
            <ul className="mt-3 space-y-2 border-t border-ink-800 pt-3 text-[13px]">
              <li className="flex justify-between gap-3 text-ink-300">
                <span>Pass</span><Placeholder>{UNDECIDED}</Placeholder>
              </li>
              <li className="flex justify-between gap-3 text-ink-300">
                <span>Period</span><Placeholder>{UNDECIDED}</Placeholder>
              </li>
              <li className="flex justify-between gap-3 border-t border-ink-800 pt-2 font-medium text-white">
                <span>Total</span><Placeholder>{UNDECIDED}</Placeholder>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </FrontOfHouse>
  )
}

/* ========================================================= checkout result */

export function CheckoutResult() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const ok = params.get('status') !== 'failed'

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <div
          className={cn(
            'mx-auto flex size-14 items-center justify-center rounded-full border',
            ok ? 'border-success-500/40 bg-success-500/10 text-success-400'
               : 'border-danger-500/40 bg-danger-500/10 text-danger-400',
          )}
        >
          {ok ? <Check className="size-7" /> : <X className="size-7" />}
        </div>

        <h1 className="font-marquee mt-5 text-[clamp(1.7rem,3.6vw,2.2rem)] font-extrabold tracking-[-0.03em] text-white">
          {ok ? 'Your pass is active' : 'Payment was not completed'}
        </h1>
        <p className="mx-auto mt-3 max-w-[48ch] text-[15px] leading-relaxed text-ink-300">
          {ok
            ? 'The transaction was recorded and your pass is active. A receipt is in your billing history, and premium titles are open to you now.'
            : 'The gateway declined or cancelled the payment, so no pass was activated and you have not been charged. You can try again with the same or a different card.'}
        </p>

        {ok && (
          <dl className="mx-auto mt-6 w-full max-w-xs space-y-2 rounded-sm border border-ink-700 bg-ink-850 p-4 text-left text-[13px]">
            <div className="flex justify-between"><dt className="text-ink-300">Reference</dt><dd className="font-mono tabular-nums text-ink-100">TXN-90418</dd></div>
            <div className="flex justify-between"><dt className="text-ink-300">Amount</dt><dd><Placeholder>{UNDECIDED}</Placeholder></dd></div>
            <div className="flex justify-between"><dt className="text-ink-300">Method</dt><dd className="text-ink-100">Card ••4417</dd></div>
          </dl>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {ok ? (
            <>
              <Button variant="primary" onClick={() => nav('/browse')}>
                Start watching
              </Button>
              <Button icon={<Download className="size-4" />} onClick={() => nav('/billing')}>
                View receipt
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={() => nav('/checkout')}>
                Try again
              </Button>
              <Button onClick={() => nav('/plans')}>Back to passes</Button>
            </>
          )}
        </div>

        <button
          onClick={() => setParams({ status: ok ? 'failed' : 'ok' })}
          className="mt-8 text-[12px] text-ink-300 underline hover:text-ink-300"
        >
          Demo: show the {ok ? 'failure' : 'success'} state
        </button>
      </div>
    </FrontOfHouse>
  )
}

/* =========================================================== subscription */

export function Subscription() {
  const nav = useNavigate()
  const toast = useToast()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [active, setActive] = useState(true)

  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-marquee text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          Your pass
        </h1>

        <div className="mt-6 rounded-lg border border-ink-700 bg-ink-850 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-marquee text-[22px] font-bold text-white">
                  <Working>Season Pass</Working>
                </h2>
                <Letterboard tone={active ? 'ok' : 'bad'}>
                  {active ? 'ACTIVE' : 'CANCELLED'}
                </Letterboard>
              </div>
              <p className="mt-1.5 text-[14px] text-ink-300">
                {active
                  ? 'Renews automatically. Renewal date and amount are not yet decided.'
                  : 'Runs until the end of the current period, then stops.'}
              </p>
            </div>
            <div className="text-right">
              <Placeholder>{`${UNDECIDED} / period`}</Placeholder>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 border-t border-ink-800 pt-5 sm:grid-cols-3">
            <div><dt className="letterboard text-ink-300">Started</dt><dd className="mt-1 font-mono text-[14px] tabular-nums text-ink-100">2026-06-01</dd></div>
            <div><dt className="letterboard text-ink-300">Renews</dt><dd className="mt-1"><Placeholder>{UNDECIDED}</Placeholder></dd></div>
            <div><dt className="letterboard text-ink-300">Method</dt><dd className="mt-1 text-[14px] text-ink-100">Card ••4417</dd></div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2.5 border-t border-ink-800 pt-5">
            <Button variant="primary" icon={<ArrowUpRight className="size-4" />} onClick={() => nav('/plans')}>
              Change pass
            </Button>
            <Button icon={<CreditCard className="size-4" />} onClick={() => toast({ title: 'Payment method update is not wired in this prototype' })}>
              Update payment method
            </Button>
            <Button icon={<Receipt className="size-4" />} onClick={() => nav('/billing')}>
              Billing history
            </Button>
            {active ? (
              <Button variant="danger" className="sm:ml-auto" onClick={() => setCancelOpen(true)}>
                Cancel pass
              </Button>
            ) : (
              <Button variant="secondary" className="sm:ml-auto" onClick={() => { setActive(true); toast({ title: 'Pass resumed', tone: 'ok' }) }}>
                Resume pass
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel your Season Pass?"
        description="You keep access until the end of the current period."
        width="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setCancelOpen(false)}>Keep my pass</Button>
            <Button
              variant="danger"
              onClick={() => {
                setActive(false)
                setCancelOpen(false)
                toast({ title: 'Pass cancelled — access continues until the period ends', tone: 'bad' })
              }}
            >
              Cancel pass
            </Button>
          </>
        }
      >
        <ul className="space-y-2 text-[14px] leading-relaxed text-ink-200">
          <li>· Premium titles close to you when the period ends.</li>
          <li>· Advertising returns.</li>
          <li>· Your watchlist, history and comments are untouched.</li>
          <li>· You can claim a pass again at any time.</li>
        </ul>
      </Modal>
    </FrontOfHouse>
  )
}

/* ======================================================== billing history */

const STATUS_TONE = {
  Settled: 'ok', Refunded: 'soon', Failed: 'bad', Pending: 'review',
} as const

export function BillingHistory() {
  const toast = useToast()
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="font-marquee text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          Billing history
        </h1>
        <p className="mt-2 text-[15px] text-ink-300">
          Every transaction recorded against your account.
        </p>

        <div className="mt-7 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Reference", "Date", "Pass", "Method", "Amount", "Status", ""]}>
            <thead>
              <tr>
                <Th>Reference</Th><Th>Date</Th><Th>Pass</Th><Th>Method</Th>
                <Th numeric>Amount</Th><Th>Status</Th><Th />
              </tr>
            </thead>
            <tbody>
              {PAYMENTS.map((p) => (
                <Tr key={p.id}>
                  <Td><span className="font-mono tabular-nums text-ink-100">{p.id}</span></Td>
                  <Td><span className="font-mono tabular-nums">{p.date}</span></Td>
                  <Td>{p.plan}</Td>
                  <Td className="text-ink-300">{p.method}</Td>
                  <Td numeric><Placeholder>{UNDECIDED}</Placeholder></Td>
                  <Td><Letterboard tone={STATUS_TONE[p.status]}>{p.status.toUpperCase()}</Letterboard></Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon={<Download className="size-3.5" />}
                      onClick={() => toast({ title: `Receipt ${p.id} would download here` })}
                    >
                      Receipt
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </FrontOfHouse>
  )
}
