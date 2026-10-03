import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FrontOfHouse, useSession } from '@/components/Shell'
import { Button, Field, Input, Modal, Textarea, useToast } from '@/components/primitives'
import { billing, DEMO_TEST_CARD, validateDemoPayment, validateRefundReason, type DemoPayment, type RefundRequest, type PlansResponse, type SubscriptionStatus, type PlanChoice, type DemoPaymentInput } from '@/lib/billing'
import { actorId as actorIdOf } from '@/lib/session'

const box = 'rounded-lg border border-ink-700 bg-ink-850 p-6'
const link = 'text-cyan-300 underline hover:text-cyan-200'
const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.'
const date = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not provided'

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return <FrontOfHouse><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <p className="letterboard text-gold-400">Demo only · No real payments</p>
    <h1 className="font-marquee mt-2 text-3xl font-extrabold text-white">{title}</h1>
    <p className="mt-2 text-sm text-ink-300">TEST MODE only. No money is charged, no processor is called, and test card data is validated in memory but never stored.</p>
    <div className="mt-7">{children}</div>
  </main></FrontOfHouse>
}

function Feedback({ error, retry }: { error: string | null; retry?: () => void }) {
  return error ? <div role="alert" className="mt-4 rounded border border-danger-500/40 p-4 text-danger-400">{error} {retry && <Button size="sm" onClick={retry}>Retry</Button>}</div> : null
}

function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [value, setValue] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null); setValue(null)
    load(controller.signal).then((next) => { if (!controller.signal.aborted) setValue(next) })
      .catch((cause) => { if (!controller.signal.aborted) setError(message(cause)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  // key identifies the account and revision triggers a retry; load is a stable callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision])
  return { value, loading, error, retry: () => setRevision((n) => n + 1) }
}

export function Plans() {
  const { value, loading, error, retry } = useLoad<PlansResponse>(billing.plans, 'plans')
  return <Page title="Demo passes">
    {loading && <p role="status">Loading plans…</p>}
    <Feedback error={error} retry={retry} />
    {value && <>
      {!value.demoEnabled && <p role="status" className="mb-5 text-gold-400">Demo checkout is not enabled. No pass can be activated here.</p>}
      {value.plans.length ? <div className="grid gap-4 sm:grid-cols-2">{value.plans.map((plan) => <article key={plan.id} className={box}>
        <h2 className="font-marquee text-xl font-bold text-white">{plan.planName}</h2>
        <p className="mt-2 text-ink-200">{plan.durationDays} days · Demo price: {plan.price} (currency not specified)</p>
        {plan.benefit && <p className="mt-3 text-sm text-ink-300">{plan.benefit}</p>}
        {value.demoEnabled && (plan.planName === 'MONTHLY' || plan.planName === 'YEARLY') && <Link to={`/checkout?plan=${encodeURIComponent(plan.planName)}`} className={`${link} mt-5 inline-block`}>Choose demo pass</Link>}
      </article>)}</div> : <p>No plans are available.</p>}
    </>}
  </Page>
}

export function Checkout() {
  const { viewer, refreshAccount } = useSession()
  const actor = actorIdOf(viewer)
  const [params] = useSearchParams()
  const selected = params.get('plan')
  const nav = useNavigate()
  const { value, loading, error, retry } = useLoad<PlansResponse>(billing.plans, 'checkout')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [payment, setPayment] = useState<DemoPaymentInput>({ cardNumber: '', expiry: '', cardholderName: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof DemoPaymentInput, string>>>({})
  const plan = value?.plans.find((p) => p.planName === selected && (p.planName === 'MONTHLY' || p.planName === 'YEARLY'))
  const submit = async () => {
    if (actor == null || !plan || !value?.demoEnabled || saving) return
    const validation = validateDemoPayment(payment)
    setFieldErrors(validation)
    if (Object.keys(validation).length) return
    setSaving(true); setSubmitError(null)
    try {
      const latest = await billing.plans()
      if (!latest.demoEnabled || !latest.plans.some((p) => p.planName === plan.planName)) throw new Error('Demo checkout is no longer available.')
      await billing.checkout(plan.planName as PlanChoice, payment, actor)
      await refreshAccount().catch(() => undefined)
      nav('/checkout/result', { replace: true, state: { completed: true } })
    } catch (cause) { setSubmitError(message(cause)) }
    finally { setSaving(false) }
  }
  return <Page title="Activate a demo pass">
    {loading && <p role="status">Loading demo plan…</p>}
    <Feedback error={error} retry={retry} />
    {value && (!value.demoEnabled ? <p role="status">Demo checkout is unavailable. <Link to="/plans" className={link}>View passes</Link></p>
      : !plan ? <p>Choose an available plan on the <Link to="/plans" className={link}>passes page</Link>.</p>
      : <div className={box}>
        <h2 className="text-xl font-bold">{plan.planName}</h2>
        <p className="mt-2">{plan.durationDays} days · Demo price {plan.price} (currency not specified)</p>
        <div className="mt-5 rounded border border-gold-400/40 bg-gold-400/8 p-4 text-sm text-ink-100">
          <strong className="text-gold-300">Synthetic test data only.</strong> Use the exact demo card <code>{DEMO_TEST_CARD}</code>. Other numbers beginning 4216 may fail the checksum. Use a future MM/YY expiry. Never enter a real card.
        </div>
        {!viewer ? <Link to="/login" className={`${link} mt-4 inline-block`}>Sign in to activate</Link>
          : <form className="mt-5 grid gap-4 sm:grid-cols-2" autoComplete="off" onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <div className="sm:col-span-2"><Field label="TEST card number" required error={fieldErrors.cardNumber}>
              <Input name="demo-card" inputMode="numeric" maxLength={19} value={payment.cardNumber} invalid={!!fieldErrors.cardNumber}
                onChange={(event) => setPayment((p) => ({ ...p, cardNumber: event.target.value }))} placeholder={DEMO_TEST_CARD} />
              <Button type="button" size="sm" className="mt-2" onClick={() => {
                setPayment((p) => ({ ...p, cardNumber: DEMO_TEST_CARD }))
                setFieldErrors((errors) => ({ ...errors, cardNumber: undefined }))
              }}>Use test card</Button>
            </Field></div>
            <Field label="Future expiry (MM/YY)" required error={fieldErrors.expiry}>
              <Input name="demo-expiry" inputMode="numeric" maxLength={5} value={payment.expiry} invalid={!!fieldErrors.expiry}
                onChange={(event) => setPayment((p) => ({ ...p, expiry: event.target.value }))} placeholder="12/99" />
            </Field>
            <Field label="Test cardholder name" required error={fieldErrors.cardholderName}>
              <Input name="demo-name" maxLength={80} value={payment.cardholderName} invalid={!!fieldErrors.cardholderName}
                onChange={(event) => setPayment((p) => ({ ...p, cardholderName: event.target.value }))} placeholder="Demo Viewer" />
            </Field>
            <div className="sm:col-span-2"><Button type="submit" variant="primary" loading={saving} disabled={saving}>Validate test payment & activate</Button></div>
          </form>}
      </div>)}
    <Feedback error={submitError} />
  </Page>
}

export function CheckoutResult() {
  const location = useLocation()
  const completed = (location.state as { completed?: boolean } | null)?.completed === true
  return <Page title={completed ? 'Demo activation submitted' : 'No checkout result to show'}>
    <p>{completed ? 'The server accepted the demo activation. Check your pass for its current status.' : 'Open a pass from the plans page to begin a demo activation.'}</p>
    <Link to={completed ? '/subscription' : '/plans'} className={`${link} mt-4 inline-block`}>{completed ? 'View your pass' : 'View passes'}</Link>
  </Page>
}

export function Subscription() {
  const { viewer, refreshAccount } = useSession()
  const actor = actorIdOf(viewer)
  const load = useCallback((signal: AbortSignal) => actor == null ? Promise.reject(new Error('Sign in to continue.')) : billing.status(actor, signal), [actor])
  const { value, loading, error, retry } = useLoad<SubscriptionStatus>(load, String(actor))
  const [busy, setBusy] = useState<'cancel' | PlanChoice | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const alternative: PlanChoice | null = value?.planName === 'MONTHLY' ? 'YEARLY' : value?.planName === 'YEARLY' ? 'MONTHLY' : null

  const changePlan = async (next: PlanChoice) => {
    if (actor == null || busy) return
    if (!window.confirm(`Change immediately to the ${next.toLowerCase()} demo pass? The server will replace the current term now; unused time is not carried over.`)) return
    setBusy(next); setActionError(null)
    try { await billing.changePlan(next, actor); await refreshAccount().catch(() => undefined); retry() }
    catch (cause) { setActionError(message(cause)) }
    finally { setBusy(null) }
  }

  return <Page title="Your demo pass">
    {loading && <p role="status">Loading subscription…</p>}
    <Feedback error={error} retry={retry} />
    {value && <div className={box}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="letterboard text-ink-300">Access</p><p className="mt-1 text-lg font-semibold text-white">{value.premium ? 'Premium access active' : 'No active premium pass'}</p></div>
        <div><p className="letterboard text-ink-300">Current plan</p><p className="mt-1 text-lg font-semibold text-white">{value.planName ?? 'None'}</p></div>
        <div><p className="letterboard text-ink-300">Status</p><p className="mt-1">{value.status ?? 'Not provided'}</p></div>
        <div><p className="letterboard text-ink-300">Term</p><p className="mt-1">{date(value.startDate)}<br />through {date(value.endDate)}</p></div>
      </div>
      {value.premium && <div className="mt-6 border-t border-ink-700 pt-5">
        <h2 className="font-marquee text-lg font-bold text-white">Manage this pass</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">Plan changes take effect immediately. The current term is replaced with a new term for the selected plan; unused demo time is not prorated or carried over.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {alternative && <Button loading={busy === alternative} disabled={busy != null} onClick={() => void changePlan(alternative)}>Change to {alternative.toLowerCase()}</Button>}
          <Button variant="danger" loading={busy === 'cancel'} disabled={busy != null} onClick={async () => {
            if (actor == null || busy || !window.confirm('Cancel this demo subscription immediately? Premium access ends now.')) return
            setBusy('cancel'); setActionError(null)
            try { await billing.cancel(actor); await refreshAccount().catch(() => undefined); retry() }
            catch (cause) { setActionError(message(cause)) }
            finally { setBusy(null) }
          }}>Cancel immediately</Button>
        </div>
      </div>}
      <Feedback error={actionError} />
    </div>}
    <Link className={`${link} mt-5 inline-block`} to="/billing">Demo billing history & refunds</Link>
  </Page>
}

export function BillingHistory() {
  const { viewer } = useSession()
  const actor = actorIdOf(viewer)
  const toast = useToast()
  const [payments, setPayments] = useState<DemoPayment[] | null>(null)
  const [refunds, setRefunds] = useState<RefundRequest[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<DemoPayment | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (actor == null) return
    const abort = new AbortController()
    setLoading(true); setError(null)
    Promise.all([billing.payments(actor, abort.signal), billing.refunds(actor, abort.signal)])
      .then(([nextPayments, nextRefunds]) => { setPayments(nextPayments); setRefunds(nextRefunds) })
      .catch((cause) => { if (!abort.signal.aborted) setError(message(cause)) })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [actor, revision])

  const openRefund = (payment: DemoPayment) => {
    setSelected(payment); setReason(''); setReasonError(null)
  }
  const submitRefund = async () => {
    if (actor == null || selected == null || saving) return
    const validation = validateRefundReason(reason)
    setReasonError(validation)
    if (validation) return
    setSaving(true)
    try {
      await billing.requestRefund(selected.id, reason, actor)
      toast({ title: 'Refund request submitted', tone: 'ok' })
      setSelected(null); setRevision((n) => n + 1)
    } catch (cause) { setReasonError(message(cause)) }
    finally { setSaving(false) }
  }

  return <Page title="Demo billing history">
    {loading && <p role="status">Loading demo records…</p>}
    <Feedback error={error} retry={() => setRevision((n) => n + 1)} />
    {!loading && payments && refunds && (payments.length === 0 ? <p>No demo payment records yet.</p> : <ul className="space-y-3">{payments.map((payment) => {
      const request = refunds.find((item) => item.paymentId === payment.id && !['REJECTED', 'CANCELLED'].includes(item.status))
      const refundable = ['PAID', 'SUCCESS', 'SETTLED', 'SIMULATED'].includes(payment.payStatus ?? '')
      return <li key={payment.id} className={box}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-white">{payment.planName ?? 'Demo pass'} · {payment.payStatus ?? 'Status unknown'}</p>
            <p className="mt-2 text-sm text-ink-300">Demo amount: {payment.amount} (currency not specified)</p>
            <p className="text-sm text-ink-300">{date(payment.paidDatetime)} · {payment.payMethod ?? 'Method not specified'}</p>
            {(payment.cardBrand || payment.cardLast4) && <p className="text-sm text-ink-300">Synthetic {payment.cardBrand ?? 'card'} ending {payment.cardLast4 ?? '—'}</p>}
          </div>
          {request ? <span className="letterboard rounded border border-gold-400/40 px-2 py-1 text-gold-300">Refund {request.status}</span>
            : <Button size="sm" disabled={!refundable} title={!refundable ? 'Only settled demo payments can be refunded.' : undefined} onClick={() => openRefund(payment)}>Request refund</Button>}
        </div>
        {request && <div className="mt-4 border-t border-ink-700 pt-3 text-sm text-ink-300">
          <p><span className="text-ink-100">Reason:</span> {request.reason}</p>
          {request.processingNote && <p className="mt-1"><span className="text-ink-100">Decision note:</span> {request.processingNote}</p>}
        </div>}
      </li>
    })}</ul>)}
    <Modal open={selected != null} onClose={() => !saving && setSelected(null)} title="Request a demo refund" description="The request is tied to this payment. A second open request for the same payment is not allowed."
      footer={<><Button variant="quiet" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button><Button loading={saving} onClick={() => void submitRefund()}>Submit request</Button></>}>
      {selected && <div>
        <p className="mb-4 text-sm text-ink-300">Payment #{selected.id} · {selected.planName ?? 'Demo pass'} · amount {selected.amount}</p>
        <Field label="Reason" required error={reasonError ?? undefined} hint={`${reason.trim().length}/255`}>
          <Textarea maxLength={255} value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(null) }} placeholder="Explain why this demo payment should be refunded." />
        </Field>
      </div>}
    </Modal>
  </Page>
}
