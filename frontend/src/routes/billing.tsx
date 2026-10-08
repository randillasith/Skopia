import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FrontOfHouse, useSession } from '@/components/Shell'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/primitives'
import { billing, monthlyPreviewPlan, REFUND_CATEGORIES, testCardNumber, validateBilling, validateTestCard, validateRefundReason, type BillingContact, type OrderView, type DemoPayment, type RefundCategory, type RefundEligibility, type RefundHistoryEntry, type RefundRequest, type PlansResponse, type SubscriptionStatus } from '@/lib/billing'
import { actorId as actorIdOf } from '@/lib/session'
import { ArrowRight, Check, CreditCard, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import './billing.css'

const box = 'rounded-lg border border-ink-700 bg-ink-850 p-6'
const link = 'text-tone-cyan-300 underline hover:text-tone-cyan-200'
const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.'
const date = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not provided'
const disclaimer = 'Simulation—no real money or bank transfer. Do not enter card details or submit a real payment.'

function Page({ title, children, notice = disclaimer, wide = false }: { title: string; children: React.ReactNode; notice?: string; wide?: boolean }) {
  return <FrontOfHouse><main className={`mx-auto px-4 py-10 sm:px-6 sm:py-14 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
    <p className="letterboard text-tone-gold-400">30-day subscription · no automatic renewal</p>
    <h1 className="font-marquee mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-fg sm:text-5xl">{title}</h1>
    <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-md border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-sm font-semibold text-tone-gold-300"><ShieldCheck aria-hidden="true" className="size-4 shrink-0" />{notice}</p>
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
  return <Page wide title="A month of more to watch." notice="No charge · test cards only · no payment. Never enter a real card number.">
    <p className="mb-8 max-w-xl text-lg text-ink-200">Explore premium viewing for 30 days. One pass, no recurring charge, no automatic renewal.</p>
    {loading && <p role="status">Loading plans…</p>}
    <Feedback error={error} retry={retry} />
    {value && (!monthly ? <p>No monthly plan is available.</p> : <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <article className="billing-panel relative overflow-hidden rounded-2xl border border-violet-400/30 bg-ink-850 p-6 sm:p-9">
        <span className="letterboard text-tone-cyan-300">THE MONTHLY PASS</span>
        <h2 className="font-marquee mt-4 text-3xl font-bold text-fg">30 days, your way.</h2>
        <p className="mt-5 text-sm text-ink-200">Listed plan price <span className="line-through">LKR {monthly.price}</span></p>
        <p className="mt-1 font-marquee text-5xl font-bold tracking-tight text-fg">LKR 0 <span className="text-base font-normal text-ink-200">due today</span></p>
        <div className="my-7 h-px bg-ink-600" />
        <ul className="space-y-4 text-ink-100">
          <li className="flex gap-3"><Check aria-hidden="true" className="size-5 shrink-0 text-tone-cyan-300" />30 days of access</li>
          <li className="flex gap-3"><Check aria-hidden="true" className="size-5 shrink-0 text-tone-cyan-300" />{monthly.adFree ? 'Ad-free viewing while active' : 'Viewing with advertisements'}</li>
          {monthly.benefit && !/test.only|preview|simulat/i.test(monthly.benefit) && <li className="flex gap-3"><Check aria-hidden="true" className="size-5 shrink-0 text-tone-cyan-300" />{monthly.benefit}</li>}
          <li className="flex gap-3"><Check aria-hidden="true" className="size-5 shrink-0 text-tone-cyan-300" />No automatic renewal</li>
        </ul>
        {value.previewMode ? <Link to="/checkout?plan=MONTHLY" className="mt-9 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-violet-500 px-5 py-3 font-semibold text-white shadow-e2 transition-colors hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Continue to no-charge checkout <ArrowRight aria-hidden="true" className="size-4" /></Link> : <p role="status" className="mt-8 text-tone-gold-400">No-charge checkout is unavailable.</p>}
        <p className="mt-4 text-center text-xs text-ink-300">No charge today. No renewal later.</p>
      </article>
      <aside className="billing-panel flex flex-col justify-center rounded-2xl border border-ink-700 bg-ink-850 p-7 sm:p-10">
        <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Sparkles aria-hidden="true" /></div>
        <h2 className="font-marquee mt-6 text-2xl font-bold text-fg">Made for the next discovery.</h2>
        <p className="mt-3 leading-relaxed text-ink-200">Your pass starts when you activate it and ends after 30 days. Nothing renews behind the scenes.</p>
        <div className="mt-8 border-t border-ink-700 pt-6 text-sm text-ink-300">You can manage your access from your subscription page at any time.</div>
      </aside>
    </div>)}
  </Page>
}
const emptyContact: BillingContact = { fullName: '', email: '', phone: '', addressLine1: '', addressLine2: '', city: '', postalCode: '', country: 'LK' }
const contactFields: { key: keyof BillingContact; label: string; required?: boolean; type?: string }[] = [
  { key: 'fullName', label: 'Full name', required: true }, { key: 'email', label: 'Email', required: true, type: 'email' },
  { key: 'phone', label: 'Phone', required: true, type: 'tel' }, { key: 'addressLine1', label: 'Address line 1', required: true },
  { key: 'addressLine2', label: 'Address line 2 (optional)' }, { key: 'city', label: 'City', required: true },
  { key: 'postalCode', label: 'Postal code', required: true },
]
function TestCardPreview({ number, expiry }: { number: string; expiry: string }) {
  const [flipped, setFlipped] = useState(false)
  const validation = validateTestCard(number, expiry)
  const published = 'brand' in validation
  const displayNumber = published ? number.replace(/ /g, '').match(/.{1,4}/g)?.join(' ') : '••••  ••••  ••••  ••••'
  return <div className="mx-auto w-full max-w-[440px]">
    <div className="billing-card-scene" aria-label="Synthetic test card preview">
      <div className={`billing-card ${flipped ? 'billing-card--flipped' : ''}`}>
        <div data-card-face="front" aria-hidden={flipped} className="billing-card-face billing-card-front">
          <div className="flex items-start justify-between"><span className="font-marquee text-xl font-black tracking-[0.2em]">SKOPIA</span><CreditCard aria-hidden="true" className="size-7 opacity-75" /></div>
          <div className="billing-chip mt-auto" aria-hidden="true"><span /></div>
          <p className="billing-card-number mt-5 font-mono text-lg tracking-[0.12em] sm:text-xl">{displayNumber}</p>
          <div className="mt-4 flex items-end justify-between gap-2 text-[10px] font-semibold uppercase tracking-widest"><div><span className="block opacity-60">Test card</span><span className="mt-1 block text-sm">No payment</span></div><div><span className="block opacity-60">Expires</span><span className="mt-1 block font-mono text-sm">{published ? expiry : 'MM/YY'}</span></div><strong className="text-sm italic tracking-tight">{published ? validation.brand === 'VISA' ? 'VISA' : 'Mastercard' : 'TEST'}</strong></div>
        </div>
        <div data-card-face="back" aria-hidden={!flipped} className="billing-card-face billing-card-back">
          <span className="text-xs font-bold tracking-[0.2em]">SKOPIA · TEST ONLY</span>
          <div className="billing-card-stripe" aria-hidden="true" />
          <div className="billing-card-signature"><span>DECORATIVE PREVIEW</span><span aria-label="Masked decorative code">•••</span></div>
          <p className="mt-auto max-w-[28ch] text-xs leading-relaxed opacity-80">No security code is requested. This is not a payment card.</p>
        </div>
      </div>
    </div>
    <button type="button" aria-label={flipped ? 'Show front of test card' : 'Show back of test card'} aria-pressed={flipped} onClick={() => setFlipped((value) => !value)} className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-md border border-ink-500 px-4 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-cyan-300"><RotateCcw aria-hidden="true" className="size-4" />{flipped ? 'Show front' : 'Show back'}</button>
    <p className="mt-3 text-center text-xs text-ink-300">Visual preview · only published test numbers appear</p>
  </div>
}
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
  return <Page wide title="Your next 30 days start here." notice="No charge · test cards only · no payment. Never enter a real card number or security code.">
    {loading && <p role="status">Loading monthly plan…</p>}
    <Feedback error={error} retry={retry} />
    {value && (!value.previewMode ? <p role="status">No-charge checkout is unavailable. <Link to="/plans" className={link}>View plan</Link></p>
      : !plan ? <p>Choose the monthly plan on the <Link to="/plans" className={link}>plans page</Link>.</p>
      : <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
        <div className="rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:p-8">
        <span className="letterboard text-tone-cyan-300">01 / ACTIVATION DETAILS</span>
        <h2 className="font-marquee mt-3 text-2xl font-bold">Monthly · 30 days</h2>
        <p className="mt-2 text-sm text-ink-200">Listed plan price LKR {plan.price} · amount due LKR 0 · no automatic renewal</p>
        {!viewer ? <Link to="/login" className={`${link} mt-4 inline-block`}>Sign in to continue</Link>
          : <form className="mt-5 space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-4 font-semibold text-fg">Billing contact</legend>
              {contactFields.map(({ key, label, required, type }) => <Field key={key} label={label} required={required} error={fieldErrors[key]}>
                <Input name={key} type={type} maxLength={key === 'email' ? 254 : 160} value={contact[key]} invalid={!!fieldErrors[key]}
                  onChange={(event) => { setContact((previous) => ({ ...previous, [key]: event.target.value })); setFieldErrors((previous) => ({ ...previous, [key]: undefined })) }} />
              </Field>)}
              <Field label="Country"><Input value="Sri Lanka (LK)" readOnly /></Field>
            </fieldset>
            <fieldset className="border-t border-ink-700 pt-5"><legend className="font-semibold text-fg">Test card · no payment</legend>
              <p className="mt-2 text-sm text-ink-300">Choose a Visa or Mastercard example, or enter that example yourself. Real card details are not accepted.</p>
              <div className="mt-3 flex flex-wrap gap-3">{(['VISA', 'MASTERCARD'] as const).map((network) => <Button key={network} type="button" size="sm" onClick={() => {
                setCardNumber(testCardNumber(network)); const next = new Date(); next.setFullYear(next.getFullYear() + 1)
                setExpiry(`${String(next.getMonth() + 1).padStart(2, '0')}/${String(next.getFullYear()).slice(-2)}`); setCardError(null)
              }}>Use {network === 'VISA' ? 'Visa' : 'Mastercard'} example</Button>)}</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Test card number" required error={cardError ?? undefined}><Input name="test-card-number" inputMode="numeric" autoComplete="off" maxLength={19} value={cardNumber}
                  onChange={(event) => { setCardNumber(event.target.value); setCardError(null) }} /></Field>
                <Field label="Expiration (MM/YY)" required><Input name="test-card-expiry" inputMode="numeric" autoComplete="off" placeholder="MM/YY" maxLength={5} value={expiry}
                  onChange={(event) => { setExpiry(event.target.value); setCardError(null) }} /></Field>
              </div>
            </fieldset>
            <p className="text-xs text-ink-300">Your card number and expiration stay on this page and are never submitted or stored.</p>
            <Button className="min-h-12 w-full sm:w-auto" type="submit" variant="primary" loading={saving} disabled={saving}>Activate 30-day access at LKR 0 <ArrowRight aria-hidden="true" className="size-4" /></Button>
          </form>}
        </div>
        <aside className="rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:p-7 lg:sticky lg:top-24">
          <span className="letterboard text-tone-cyan-300">02 / TEST CARD PREVIEW</span>
          <h2 className="font-marquee mt-3 text-xl font-bold text-fg">See your test card</h2>
          <p className="mb-6 mt-2 text-sm text-ink-200">Only an exact published synthetic number with a valid expiration appears on the preview.</p>
          <TestCardPreview number={cardNumber} expiry={expiry} />
          <div className="mt-7 flex justify-between gap-4 border-t border-ink-700 pt-5 text-sm"><span className="text-ink-200">Total due today</span><strong className="font-mono text-lg text-fg">LKR 0</strong></div>
          <p className="mt-2 text-xs text-ink-300">No payment provider · no automatic renewal</p>
        </aside>
      </section>)}
    <Feedback error={submitError} />
  </Page>
}
export function CheckoutResult() {
  const location = useLocation()
  const order = (location.state as { order?: OrderView } | null)?.order
  const active = order?.status === 'NO_CHARGE_ACTIVE'
  return <Page title={active ? 'Your 30 days start now.' : order ? 'Order recorded' : 'No checkout result to show'} notice="No charge · test cards only · no payment.">
    {order ? <section data-activation-result className="billing-panel rounded-2xl border border-violet-400/30 bg-ink-850 p-6 sm:p-10">
      <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Check aria-hidden="true" /></div>
      <p className="letterboard mt-6 text-tone-cyan-300">{active ? 'ACCESS ACTIVATED' : 'ORDER UPDATE'}</p>
      <h2 className="font-marquee mt-2 text-2xl font-bold text-fg sm:text-3xl">{active ? 'Ready when you are.' : 'View your order details.'}</h2>
      <p className="mt-3 max-w-xl text-ink-200">{active ? 'Your 30-day access is active. No payment was processed.' : 'This historical sample order did not process a payment.'}</p>
      <div className="mt-7 flex flex-wrap gap-6 border-y border-ink-700 py-5 text-sm"><div><span className="block text-ink-300">Order</span><strong className="mt-1 block text-fg">#{order.id}</strong></div><div><span className="block text-ink-300">Status</span><strong className="mt-1 block text-fg">{order.status}</strong></div><div><span className="block text-ink-300">Total paid</span><strong className="mt-1 block text-fg">LKR 0</strong></div></div>
      <Link to="/subscription" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-violet-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">View your subscription <ArrowRight aria-hidden="true" className="size-4" /></Link>
    </section> : <Link to="/plans" className={link}>View monthly plan</Link>}
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
  return <Page wide title="Your subscription" notice="No charge · test cards only · no payment for no-charge access. Historical sample orders are shown separately.">
    {loading && <p role="status">Loading subscription…</p>}
    <Feedback error={error} retry={retry} />
    {value && <div data-subscription-summary className="billing-panel rounded-2xl border border-violet-400/30 bg-ink-850 p-6 sm:p-9">
      <span className="letterboard text-tone-cyan-300">CURRENT ACCESS</span>
      <h2 className="font-marquee mt-3 text-2xl font-bold text-fg">{value.premium ? 'Premium access active' : 'No active premium pass'}</h2>
      <div className="mt-7 grid gap-5 border-t border-ink-700 pt-6 sm:grid-cols-3">
        <div><p className="letterboard text-ink-300">Plan</p><p className="mt-2 text-lg font-semibold text-fg">{value.planName ?? 'None'}</p></div>
        <div><p className="letterboard text-ink-300">Status</p><p className="mt-2 text-lg font-semibold text-fg">{value.status ?? 'Not provided'}</p></div>
        <div><p className="letterboard text-ink-300">Term</p><p className="mt-2 text-sm text-fg">{date(value.startDate)}<br />through {date(value.endDate)}</p></div>
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
        : orders.value?.length ? <ul className="grid gap-4 md:grid-cols-2">{orders.value.map((order) => <li data-subscription-order className="rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:p-6" key={order.id}><span className="letterboard text-tone-cyan-300">ORDER #{order.id}</span><h3 className="font-marquee mt-3 text-lg font-semibold text-fg">{order.planName} · {order.status.replaceAll('_', ' ')}</h3><p className="mt-3 text-sm text-ink-300">{order.method === 'NO_CHARGE_TEST_CARD' ? 'Amount due: LKR 0 · no payment was processed.' : order.status === 'PENDING_REVIEW' ? 'Pending admin review. No entitlement until approval.' : 'Historical simulation only; no payment was made.'}</p>{(order.decisionNote || order.note) && <p className="mt-3 text-sm text-ink-200">Review note: {order.decisionNote || order.note}</p>}</li>)}</ul>
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
