import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FrontOfHouse, useSession } from '@/components/Shell'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/primitives'
import { billing, monthlyPreviewPlan, REFUND_CATEGORIES, testCardNumber, validateBilling, validateTestCard, validateRefundReason, type BillingContact, type OrderView, type DemoPayment, type RefundCategory, type RefundEligibility, type RefundHistoryEntry, type RefundRequest, type PlansResponse, type SubscriptionStatus } from '@/lib/billing'
import { actorId as actorIdOf } from '@/lib/session'

const box = 'rounded-lg border border-ink-700 bg-ink-850 p-6'
const link = 'text-tone-cyan-300 underline hover:text-tone-cyan-200'
const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.'
const date = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not provided'
const disclaimer = 'Simulation—no real money or bank transfer. Do not enter card details or submit a real payment.'

function Page({ title, children, notice = disclaimer }: { title: string; children: React.ReactNode; notice?: string }) {
  return <FrontOfHouse><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <p className="letterboard text-tone-gold-400">30-day subscription · no automatic renewal</p>
    <h1 className="font-marquee mt-2 text-3xl font-extrabold text-fg">{title}</h1>
    <p className="mt-2 text-sm font-semibold text-tone-gold-300">{notice}</p>
    <div className="mt-7">{children}</div>
  </main></FrontOfHouse>
}
function Feedback({ error, retry }: { error: string | null; retry?: () => void }) {
  return error ? <div role="alert" className="mt-4 rounded border border-danger-500/40 p-4 text-tone-danger-400">{error} {retry && <Button size="sm" onClick={retry}>Retry</Button>}</div> : null
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision])
  return { value, loading, error, retry: () => setRevision((n) => n + 1) }
}
export function Plans() {
  const { value, loading, error, retry } = useLoad<PlansResponse>(billing.plans, 'plans')
  const monthly = value && monthlyPreviewPlan(value)
  return <Page title="Monthly subscription" notice="No charge · test cards only · no payment. Never enter a real card number.">
    <p className="mb-5 text-ink-200">30 days of access. No recurring charge or automatic renewal.</p>
    {loading && <p role="status">Loading plans…</p>}
    <Feedback error={error} retry={retry} />
    {value && (!monthly ? <p>No monthly plan is available.</p> : <article className={box}>
      <h2 className="font-marquee text-xl font-bold text-fg">Monthly · 30 days</h2>
      <p className="mt-2 text-ink-200">Listed plan price: LKR {monthly.price}. Amount due for this no-charge access: LKR 0.</p>
      <p className="mt-3">{monthly.adFree ? 'Ad-free viewing while your subscription is active.' : 'Includes advertisements.'}</p>
      {monthly.benefit && <p className="mt-3 text-sm text-ink-300">{monthly.benefit}</p>}
      {value.previewMode ? <Link to="/checkout?plan=MONTHLY" className={`${link} mt-5 inline-block`}>Continue to no-charge checkout</Link> : <p role="status" className="mt-4 text-tone-gold-400">No-charge checkout is unavailable.</p>}
    </article>)}
  </Page>
}
const emptyContact: BillingContact = { fullName: '', email: '', phone: '', addressLine1: '', addressLine2: '', city: '', postalCode: '', country: 'LK' }
const contactFields: { key: keyof BillingContact; label: string; required?: boolean; type?: string }[] = [
  { key: 'fullName', label: 'Full name', required: true }, { key: 'email', label: 'Email', required: true, type: 'email' },
  { key: 'phone', label: 'Phone', required: true, type: 'tel' }, { key: 'addressLine1', label: 'Address line 1', required: true },
  { key: 'addressLine2', label: 'Address line 2 (optional)' }, { key: 'city', label: 'City', required: true },
  { key: 'postalCode', label: 'Postal code', required: true },
]
export function Checkout() {
  const { viewer, refreshAccount } = useSession()
  const actor = actorIdOf(viewer)
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { value, loading, error, retry } = useLoad<PlansResponse>(billing.plans, 'checkout')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [contact, setContact] = useState<BillingContact>(emptyContact)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BillingContact, string>>>({})
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cardError, setCardError] = useState<string | null>(null)
  const plan = params.get('plan') === 'MONTHLY' && value && monthlyPreviewPlan(value)
  const submit = async () => {
    if (actor == null || !plan || !value?.previewMode || saving) return
    const validation = validateBilling(contact)
    setFieldErrors(validation)
    const cardValidation = validateTestCard(cardNumber, expiry)
    setCardError('error' in cardValidation ? cardValidation.error : null)
    if (Object.keys(validation).length || 'error' in cardValidation) return
    setSaving(true); setSubmitError(null)
    try {
      const latest = await billing.plans()
      if (!latest.previewMode || !latest.plans.some((p) => p.planName === 'MONTHLY')) throw new Error('Monthly subscription is no longer available.')
      const order = await billing.noChargeCard(cardNumber, expiry, contact, actor)
      setCardNumber(''); setExpiry('')
      await refreshAccount().catch(() => undefined)
      nav('/checkout/result', { replace: true, state: { order } })
    } catch (cause) { setSubmitError(message(cause)) }
    finally { setSaving(false) }
  }
  return <Page title="Activate your 30-day subscription" notice="No charge · test cards only · no payment. Never enter a real card number or security code.">
    {loading && <p role="status">Loading monthly plan…</p>}
    <Feedback error={error} retry={retry} />
    {value && (!value.previewMode ? <p role="status">No-charge checkout is unavailable. <Link to="/plans" className={link}>View plan</Link></p>
      : !plan ? <p>Choose the monthly plan on the <Link to="/plans" className={link}>plans page</Link>.</p>
      : <section className={box}>
        <h2 className="text-xl font-bold">Monthly · 30 days</h2>
        <p className="mt-2">Listed plan price LKR {plan.price} · amount due LKR 0 · no automatic renewal</p>
        {!viewer ? <Link to="/login" className={`${link} mt-4 inline-block`}>Sign in to continue</Link>
          : <form className="mt-5 space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-4 font-semibold">Billing contact</legend>
              {contactFields.map(({ key, label, required, type }) => <Field key={key} label={label} required={required} error={fieldErrors[key]}>
                <Input name={key} type={type} maxLength={key === 'email' ? 254 : 160} value={contact[key]} invalid={!!fieldErrors[key]}
                  onChange={(event) => { setContact((previous) => ({ ...previous, [key]: event.target.value })); setFieldErrors((previous) => ({ ...previous, [key]: undefined })) }} />
              </Field>)}
              <Field label="Country"><Input value="Sri Lanka (LK)" readOnly /></Field>
            </fieldset>
            <fieldset className="border-t border-ink-700 pt-5"><legend className="font-semibold">Test card · no payment</legend>
              <p className="mt-2 text-sm text-ink-300">Only the published synthetic Visa or Mastercard numbers below work. This checks format and expiration locally; it does not validate a real card or contact a payment provider.</p>
              <div className="mt-3 flex flex-wrap gap-3">{(['VISA', 'MASTERCARD'] as const).map((network) => <Button key={network} type="button" size="sm" onClick={() => {
                setCardNumber(testCardNumber(network)); const next = new Date(); next.setFullYear(next.getFullYear() + 1)
                setExpiry(`${String(next.getMonth() + 1).padStart(2, '0')}/${String(next.getFullYear()).slice(-2)}`); setCardError(null)
              }}>Use {network === 'VISA' ? 'Visa' : 'Mastercard'} test number: {testCardNumber(network)}</Button>)}</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Test card number" required error={cardError ?? undefined}><Input name="test-card-number" inputMode="numeric" autoComplete="off" maxLength={19} value={cardNumber}
                  onChange={(event) => { setCardNumber(event.target.value); setCardError(null) }} /></Field>
                <Field label="Expiration (MM/YY)" required><Input name="test-card-expiry" inputMode="numeric" autoComplete="off" placeholder="MM/YY" maxLength={5} value={expiry}
                  onChange={(event) => { setExpiry(event.target.value); setCardError(null) }} /></Field>
              </div>
            </fieldset>
            <p className="text-sm font-semibold text-tone-gold-300">No charge · test cards only · no payment. Your inputs stay in this page and are never submitted or stored.</p>
            <Button type="submit" variant="primary" loading={saving} disabled={saving}>Activate 30-day access at LKR 0</Button>
          </form>}
      </section>)}
    <Feedback error={submitError} />
  </Page>
}
export function CheckoutResult() {
  const location = useLocation()
  const order = (location.state as { order?: OrderView } | null)?.order
  return <Page title={order ? 'Subscription access activated' : 'No checkout result to show'} notice="No charge · test cards only · no payment.">
    {order ? <><p>Order #{order.id} · {order.status}. {order.status === 'NO_CHARGE_ACTIVE' ? 'Your 30-day access is active. Amount charged: LKR 0; no payment was processed.' : 'Historical sample order; no charge occurred.'}</p>
      <Link to="/subscription" className={`${link} mt-4 inline-block`}>View your subscription and orders</Link></>
      : <Link to="/plans" className={link}>View monthly plan</Link>}
  </Page>
}
export function Subscription() {
  const { viewer, refreshAccount } = useSession()
  const actor = actorIdOf(viewer)
  const load = useCallback((signal: AbortSignal) => actor == null ? Promise.reject(new Error('Sign in to continue.')) : billing.status(actor, signal), [actor])
  const { value, loading, error, retry } = useLoad<SubscriptionStatus>(load, String(actor))
  const loadOrders = useCallback((signal: AbortSignal) => actor == null ? Promise.reject(new Error('Sign in to continue.')) : billing.orders(actor, signal), [actor])
  const orders = useLoad<OrderView[]>(loadOrders, `orders-${actor}`)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  return <Page title="Your subscription" notice="No charge · test cards only · no payment for no-charge access. Historical sample orders are shown separately.">
    {loading && <p role="status">Loading subscription…</p>}
    <Feedback error={error} retry={retry} />
    {value && <div className={box}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="letterboard text-ink-300">Access</p><p className="mt-1 text-lg font-semibold text-fg">{value.premium ? 'Premium access active' : 'No active premium pass'}</p></div>
        <div><p className="letterboard text-ink-300">Current plan</p><p className="mt-1 text-lg font-semibold text-fg">{value.planName ?? 'None'}</p></div>
        <div><p className="letterboard text-ink-300">Status</p><p className="mt-1">{value.status ?? 'Not provided'}</p></div>
        <div><p className="letterboard text-ink-300">Term</p><p className="mt-1">{date(value.startDate)}<br />through {date(value.endDate)}</p></div>
      </div>
      <p className="mt-5 text-ink-200">{value.adFree ? 'Ad-free viewing is active until this pass ends.' : 'Viewing includes advertisements. Pending sample orders do not grant access.'}</p>
      {value.premium && <div className="mt-6 border-t border-ink-700 pt-5"><p className="mb-3 text-sm">Canceling ends access immediately. No payment or refund occurs for a no-charge pass.</p>
        <Button variant="danger" loading={busy} disabled={busy} onClick={async () => {
          if (actor == null || busy || !window.confirm('Cancel this subscription immediately? Access ends now.')) return
          setBusy(true); setActionError(null)
          try { await billing.cancel(actor); await refreshAccount().catch(() => undefined); retry() }
          catch (cause) { setActionError(message(cause)) } finally { setBusy(false) }
        }}>Cancel immediately</Button>
      </div>}
      <Feedback error={actionError} />
    </div>}
    <section className="mt-6"><h2 className="mb-3 text-xl font-bold">Subscription orders</h2>
      {orders.loading ? <p role="status">Loading orders…</p> : orders.error ? <Feedback error={orders.error} retry={orders.retry} />
        : orders.value?.length ? <ul className="space-y-3">{orders.value.map((order) => <li className={box} key={order.id}>#{order.id} · {order.planName} · {order.status}<p className="mt-1 text-sm text-ink-300">{order.method === 'NO_CHARGE_TEST_CARD' ? 'Amount due: LKR 0 · no payment was processed.' : order.status === 'PENDING_REVIEW' ? 'Pending admin review. No entitlement until approval.' : 'Historical simulation only; no payment was made.'}</p>{(order.decisionNote || order.note) && <p className="mt-1 text-sm">Review note: {order.decisionNote || order.note}</p>}</li>)}</ul>
        : <p>No subscription orders yet.</p>}
      <Button className="mt-3" size="sm" onClick={() => { orders.retry(); retry() }}>Refresh status and orders</Button>
    </section>
    <Link className={`${link} mt-5 inline-block`} to="/billing">Historical demo billing records & refunds</Link>
  </Page>
}
export function BillingHistory() {
  const { viewer } = useSession()
  const actor = actorIdOf(viewer)
  const toast = useToast()
  const [payments, setPayments] = useState<DemoPayment[] | null>(null)
  const [refunds, setRefunds] = useState<RefundRequest[] | null>(null)
  const [eligibility, setEligibility] = useState<Record<number, RefundEligibility>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<DemoPayment | null>(null)
  const [category, setCategory] = useState<RefundCategory>('ACCIDENTAL_PURCHASE')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [historyFor, setHistoryFor] = useState<RefundRequest | null>(null)
  const [history, setHistory] = useState<RefundHistoryEntry[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    if (actor == null) return
    const abort = new AbortController()
    setLoading(true); setError(null)
    Promise.all([billing.payments(actor, abort.signal), billing.refunds(actor, abort.signal)])
      .then(async ([nextPayments, nextRefunds]) => {
        const checks = await Promise.all(nextPayments.map(async (payment) => {
          try { return [payment.id, await billing.refundEligibility(payment.id, actor, abort.signal)] as const }
          catch { return [payment.id, { eligible: false, reason: 'UNAVAILABLE', windowDays: 0 }] as const }
        }))
        if (!abort.signal.aborted) {
          setPayments(nextPayments); setRefunds(nextRefunds); setEligibility(Object.fromEntries(checks))
        }
      })
      .catch((cause) => { if (!abort.signal.aborted) setError(message(cause)) })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [actor, revision])

  const notifyRefundChange = () => {
    window.dispatchEvent(new Event('skopia:refunds-changed'))
    window.dispatchEvent(new Event('skopia:notifications-changed'))
  }
  const openRefund = (payment: DemoPayment) => {
    setSelected(payment); setCategory('ACCIDENTAL_PURCHASE'); setReason(''); setReasonError(null)
  }
  const submitRefund = async () => {
    if (actor == null || selected == null || saving) return
    const validation = validateRefundReason(reason)
    setReasonError(validation)
    if (validation) return
    setSaving(true)
    try {
      await billing.requestRefund(selected.id, category, reason, actor)
      toast({ title: 'Refund request submitted', tone: 'ok' })
      setSelected(null); notifyRefundChange(); setRevision((n) => n + 1)
    } catch (cause) { setReasonError(message(cause)) }
    finally { setSaving(false) }
  }
  const cancelRefund = async (request: RefundRequest) => {
    if (actor == null || saving || !window.confirm('Cancel this pending refund request? It cannot be resubmitted for this payment.')) return
    setSaving(true)
    try {
      await billing.cancelRefund(request.id, actor)
      toast({ title: 'Refund request cancelled', tone: 'ok' })
      notifyRefundChange(); setRevision((n) => n + 1)
    } catch (cause) { toast({ title: message(cause), tone: 'bad' }) }
    finally { setSaving(false) }
  }
  const showHistory = async (request: RefundRequest) => {
    if (actor == null) return
    setHistoryFor(request); setHistory(null); setHistoryError(null)
    try { setHistory(await billing.refundHistory(request.id, actor)) }
    catch (cause) { setHistoryError(message(cause)) }
  }

  return <Page title="Demo billing history">
    {loading && <p role="status">Loading demo records…</p>}
    <Feedback error={error} retry={() => setRevision((n) => n + 1)} />
    {!loading && payments && refunds && (payments.length === 0 ? <p>No demo payment records yet.</p> : <ul className="space-y-3">{payments.map((payment) => {
      const request = refunds.find((item) => item.paymentId === payment.id)
      const check = eligibility[payment.id]
      return <li key={payment.id} className={box}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-fg">{payment.planName ?? 'Demo pass'} · {payment.payStatus ?? 'Status unknown'}</p>
            <p className="mt-2 text-sm text-ink-300">Demo amount: {payment.amount} {request?.currency ?? payment.currency ?? 'currency not specified'}</p>
            <p className="text-sm text-ink-300">{date(payment.paidDatetime)} · {payment.payMethod ?? 'Method not specified'}</p>
            {(payment.cardBrand || payment.cardLast4) && <p className="text-sm text-ink-300">Synthetic {payment.cardBrand ?? 'card'} ending {payment.cardLast4 ?? '—'}</p>}
            {!request && check && <p className={`mt-2 text-xs ${check.eligible ? 'text-tone-cyan-300' : 'text-ink-400'}`}>{check.eligible ? `Eligible for ${check.windowDays} days${check.eligibleUntil ? `, until ${date(check.eligibleUntil)}` : ''}.` : `Not eligible: ${check.reason.replaceAll('_', ' ').toLowerCase()}.`}</p>}
          </div>
          {request ? <span className="letterboard rounded border border-gold-400/40 px-2 py-1 text-tone-gold-300">Refund {request.status}</span>
            : <Button size="sm" disabled={!check?.eligible} title={!check?.eligible ? 'This payment is not eligible for a refund.' : undefined} onClick={() => openRefund(payment)}>Request refund</Button>}
        </div>
        {request && <div className="mt-4 border-t border-ink-700 pt-3 text-sm text-ink-300">
          <p><span className="text-ink-100">Category:</span> {request.category?.replaceAll('_', ' ') ?? 'Not specified'}</p>
          <p><span className="text-ink-100">Reason:</span> {request.reason}</p>
          <p><span className="text-ink-100">Amount:</span> {request.amount ?? payment.amount} {request.currency ?? ''} {request.simulation && '· simulated'}</p>
          {request.eligibleUntil && <p><span className="text-ink-100">Eligible until:</span> {date(request.eligibleUntil)}</p>}
          {request.processingNote && <p className="mt-1"><span className="text-ink-100">Decision note:</span> {request.processingNote}</p>}
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="quiet" onClick={() => void showHistory(request)}>View history</Button>{request.status === 'PENDING' && <Button size="sm" variant="danger" loading={saving} onClick={() => void cancelRefund(request)}>Cancel request</Button>}</div>
        </div>}
      </li>
    })}</ul>)}
    <Modal open={selected != null} onClose={() => !saving && setSelected(null)} title="Request a demo refund" description="Choose the category that best describes the request. Each payment can have only one refund request, even after cancellation."
      footer={<><Button variant="quiet" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button><Button loading={saving} onClick={() => void submitRefund()}>Submit request</Button></>}>
      {selected && <div className="space-y-4">
        <p className="text-sm text-ink-300">Payment #{selected.id} · {selected.planName ?? 'Demo pass'} · amount {selected.amount}</p>
        <Field label="Category" required><Select value={category} onChange={(event) => setCategory(event.target.value as RefundCategory)}>{REFUND_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
        <Field label="Reason" required error={reasonError ?? undefined} hint={`${reason.trim().length}/255`}>
          <Textarea maxLength={255} value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(null) }} placeholder="Explain why this demo payment should be refunded." />
        </Field>
      </div>}
    </Modal>
    <Modal open={historyFor != null} onClose={() => setHistoryFor(null)} title="Refund history" description={historyFor ? `Request #${historyFor.id} for payment #${historyFor.paymentId}` : undefined} footer={<Button onClick={() => setHistoryFor(null)}>Close</Button>}>
      {historyError ? <p role="alert" className="text-tone-danger-400">{historyError}</p> : history == null ? <p role="status">Loading history…</p> : history.length === 0 ? <p>No history entries were returned.</p> : <ol className="space-y-3">{history.map((entry, index) => <li key={entry.id ?? index} className="rounded border border-ink-700 p-3 text-sm"><p className="font-medium text-fg">{entry.fromStatus ? `${entry.fromStatus} → ` : ''}{entry.toStatus}</p><p className="mt-1 text-ink-300">{date(entry.changedAt ?? null)}{entry.changedByUsername ? ` · by @${entry.changedByUsername}` : ''}</p>{entry.note && <p className="mt-1 text-ink-200">{entry.note}</p>}</li>)}</ol>}
    </Modal>
  </Page>
}
