import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FrontOfHouse, useSession } from '@/components/Shell'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/primitives'
import { billing, monthlyPreviewPlan, REFUND_CATEGORIES, validateBilling, validateRefundReason, type BillingContact, type OrderView, type DemoPayment, type RefundCategory, type RefundEligibility, type RefundHistoryEntry, type RefundRequest, type PlansResponse, type SubscriptionStatus } from '@/lib/billing'
import { actorId as actorIdOf } from '@/lib/session'
import { ApiError } from '@/lib/api'
import { ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react'
import { DemoCardPreview } from '@/components/DemoCardPreview'
import { DEMO_CARDS, demoBrand, formatCardNumber, formatExpiry, futureDemoExpiry, validateDemoCard, type DemoBrand } from '@/lib/demo-card'
import './billing.css'

const box = 'rounded-lg border border-ink-700 bg-ink-850 p-6'
const link = 'billing-action billing-action-secondary'
const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.'
const date = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not provided'
const disclaimer = 'Historical simulated billing records only; no money moved.'

const planLabel = (name: string | null) => name === 'MONTHLY' ? 'Monthly pass' : name ? name.toLowerCase().replaceAll('_', ' ') : 'Free viewing'
const statusLabel = (status: string | null) => ({ ACTIVE: 'Active', CANCELLED: 'Cancelled', EXPIRED: 'Expired', INACTIVE: 'Inactive' }[status ?? ''] ?? 'No active pass')
function orderLabel(order: OrderView) {
  if (order.method === 'DEMO_CARD' && order.status === 'SIMULATED_APPROVED') return 'Simulated card activation'
  if (order.method === 'NO_CHARGE_TEST_CARD' && order.status === 'NO_CHARGE_ACTIVE') return 'Demo checkout activation'
  if (order.method === 'COMPLIMENTARY' && order.status === 'NO_CHARGE_ACTIVE') return 'Complimentary activation'
  if (['PENDING_REVIEW', 'SUBMITTED'].includes(order.status)) return 'Awaiting review'
  if (order.status === 'REJECTED') return 'Preview declined'
  if (order.status === 'CANCELLED') return 'Cancelled request'
  return 'Previous preview'
}
function MembershipPass() {
  return <div className="membership-pass" data-membership-pass>
    <div className="membership-pass-top"><span className="membership-brand">SKOPIA</span><Sparkles aria-hidden="true" className="size-5" /></div>
    <div className="membership-chip" aria-hidden="true"><i /><i /><i /></div>
    <div className="membership-pattern" aria-hidden="true">•••• &nbsp; •••• &nbsp; ••••</div>
    <div className="membership-pass-bottom"><div><span className="membership-caption">Membership pass</span><strong>30-day access</strong></div><span className="membership-mark" aria-hidden="true">S.</span></div>
    <p className="membership-caption membership-note">Decorative pass · not a payment card</p>
  </div>
}
function OrderRecord({ order }: { order: OrderView }) {
  const complimentary = ['COMPLIMENTARY', 'NO_CHARGE_TEST_CARD'].includes(order.method ?? '')
  const submitted = order.submittedAt ?? order.createdAt
  return <li data-subscription-order className="billing-order">
    <div className="billing-order-heading"><h3>{orderLabel(order)}</h3><span className="billing-badge">{complimentary ? 'No charge' : order.method === 'DEMO_CARD' ? 'Simulated payment' : 'Preview record'}</span></div>
    <p className="mt-2 text-sm text-ink-200">{planLabel(order.planName)} · Order #{order.id}</p>
    <dl className="billing-record-details">
      {order.reference && <div><dt>Reference</dt><dd>{order.reference}</dd></div>}
      {submitted && <div><dt>Recorded</dt><dd>{date(submitted)}</dd></div>}
      {order.amount != null && <div><dt>{complimentary ? 'Amount due' : 'Recorded amount (simulated)'}</dt><dd>{order.currency ?? 'LKR'} {order.amount}</dd></div>}
    </dl>
    {(order.decisionNote || order.note) && <p className="mt-3 text-sm text-ink-200">Review note: {order.decisionNote || order.note}</p>}
  </li>
}

function Page({ title, children, notice = disclaimer, wide = false }: { title: string; children: React.ReactNode; notice?: string; wide?: boolean }) {
  return <FrontOfHouse><section aria-label={title} className={`mx-auto px-4 py-10 sm:px-6 sm:py-14 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
    <p className="letterboard text-tone-gold-400">30-day subscription · no automatic renewal</p>
    <h1 className="font-marquee mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-fg sm:text-5xl">{title}</h1>
    <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-md border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-sm font-semibold text-tone-gold-300"><ShieldCheck aria-hidden="true" className="size-4 shrink-0" />{notice}</p>
    <div className="mt-7">{children}</div>
  </section></FrontOfHouse>
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
  return <Page wide title="A month of more to watch." notice="Demo · test cards only · no money charged.">
    <p className="mb-8 max-w-xl text-lg text-ink-200">Explore premium viewing for 30 days. One pass, no recurring charge, no automatic renewal.</p>
    {loading && <p role="status">Loading plans…</p>}
    <Feedback error={error} retry={retry} />
    {value && (!monthly ? <p>No monthly plan is available.</p> : <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <article className="billing-panel relative overflow-hidden rounded-2xl border border-violet-400/30 bg-ink-850 p-6 sm:p-9">
        <span className="letterboard text-tone-cyan-300">THE MONTHLY PASS</span>
        <h2 className="font-marquee mt-4 text-3xl font-bold text-fg">30 days, your way.</h2>
        <p className="mt-5 text-sm text-ink-200">Monthly subscription · 30 days</p>
        <p className="mt-1 font-marquee text-5xl font-bold tracking-tight text-fg">LKR {monthly.price} <span className="ml-2 inline-block text-base font-normal text-ink-200">/ 30 days</span></p>
        <div className="my-7 h-px bg-ink-600" />
        <ul className="space-y-4 text-ink-100">
          <li className="flex gap-3"><Check aria-hidden="true" className="size-5 shrink-0 text-tone-cyan-300" />30 days of access</li>
          <li className="flex gap-3"><Check aria-hidden="true" className="size-5 shrink-0 text-tone-cyan-300" />{monthly.adFree ? 'Ad-free viewing while active' : 'Viewing with advertisements'}</li>
          {monthly.benefit && !/test.only|preview|simulat/i.test(monthly.benefit) && <li className="flex gap-3"><Check aria-hidden="true" className="size-5 shrink-0 text-tone-cyan-300" />{monthly.benefit}</li>}
          <li className="flex gap-3"><Check aria-hidden="true" className="size-5 shrink-0 text-tone-cyan-300" />No automatic renewal</li>
        </ul>
        {value.demoEnabled ? <Link to="/checkout?plan=MONTHLY" className="mt-9 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-violet-500 px-5 py-3 font-semibold text-white shadow-e2 transition-colors hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Continue to demo checkout <ArrowRight aria-hidden="true" className="size-4" /></Link> : <p role="status" className="mt-8 text-tone-gold-400">Demo checkout is unavailable.</p>}
        <p className="mt-4 text-center text-xs text-ink-300">Simulated charge: LKR {monthly.price}. No real money charged. No automatic renewal.</p>
      </article>
      <aside className="billing-panel flex flex-col justify-center rounded-2xl border border-ink-700 bg-ink-850 p-7 sm:p-10">
        <MembershipPass />
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
export function Checkout() {
  const { viewer, refreshAccount } = useSession()
  const actor = actorIdOf(viewer)
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { value, loading, error, retry } = useLoad<PlansResponse>(billing.plans, 'checkout')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [activePassConflict, setActivePassConflict] = useState(false)
  const [contact, setContact] = useState<BillingContact>(emptyContact)
  const [testNumber, setTestNumber] = useState('')
  const [testExpiry, setTestExpiry] = useState('')
  const [cardErrors, setCardErrors] = useState<{ number?: string; expiry?: string }>({})
  const formRef = useRef<HTMLFormElement>(null)
  const fillExample = (brand: DemoBrand) => { setTestNumber(formatCardNumber(DEMO_CARDS[brand])); setTestExpiry(futureDemoExpiry()); setCardErrors({}) }
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BillingContact, string>>>({})
  const plan = params.get('plan') === 'MONTHLY' && value && monthlyPreviewPlan(value)
  const submit = async () => {
    if (actor == null || !plan || !value?.demoEnabled || saving) return
    const validation = validateBilling(contact)
    setFieldErrors(validation)
    const cardValidation = validateDemoCard(testNumber, testExpiry)
    setCardErrors(cardValidation)
    const brand = demoBrand(testNumber)
    if (Object.keys(validation).length || Object.keys(cardValidation).length || !brand) {
      const firstField = cardValidation.number ? 'testCardNumber' : cardValidation.expiry ? 'testCardExpiry' : Object.keys(validation)[0]
      formRef.current?.querySelector<HTMLInputElement>(`input[name="${firstField}"]`)?.focus()
      return
    }
    setSaving(true); setSubmitError(null); setActivePassConflict(false)
    try {
      const latest = await billing.plans()
      if (!latest.demoEnabled || !latest.plans.some((p) => p.planName === 'MONTHLY')) throw new Error('Monthly subscription is no longer available.')
      const order = await billing.demoCard(contact, brand, actor)
      setTestNumber(''); setTestExpiry('')
      await refreshAccount().catch(() => undefined)
      nav('/checkout/result', { replace: true, state: { order } })
    } catch (cause) {
      const status = cause instanceof ApiError ? cause.status : null
      setActivePassConflict(status === 409)
      setSubmitError(status === 409 ? 'You already have an active pass. No second activation was made.'
        : status === 400 ? 'Please check your billing contact details and try again.'
        : status === 401 ? 'Please sign in again before activating your pass.'
        : status === 403 ? 'This account cannot activate a pass.'
        : status === 503 ? 'Activation is temporarily unavailable. Please try again later.'
        : message(cause))
    }
    finally { setSaving(false) }
  }
  return <Page wide title="Your next 30 days start here." notice="Demo · test cards only · no money charged.">
    {loading && <p role="status">Loading monthly plan…</p>}
    <Feedback error={error} retry={retry} />
    {value && (!value.demoEnabled ? <p role="status">Demo checkout is unavailable. <Link to="/plans" className={link}>View plan</Link></p>
      : !plan ? <p>Choose the monthly plan on the <Link to="/plans" className={link}>plans page</Link>.</p>
      : <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
        <div className="rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:p-8">
        <span className="letterboard text-tone-cyan-300">01 / CHECKOUT DETAILS</span>
        <h2 className="font-marquee mt-3 text-2xl font-bold">Monthly · 30 days</h2>
        <p className="mt-2 text-sm text-ink-200">LKR {plan.price} / 30 days · no automatic renewal</p>
        {!viewer ? <Link to="/login" className={`${link} mt-4 inline-block`}>Sign in to continue</Link>
          : <form ref={formRef} className="mt-5 space-y-6" autoComplete="off" noValidate onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <fieldset className="demo-card-fields"><legend className="mb-4 font-semibold text-fg">Card details <span className="billing-badge ml-2">Test only</span></legend>
              <div className="demo-example-row"><span className="text-sm text-ink-300">Use a test example</span><button type="button" className="demo-example" onClick={() => fillExample('VISA')}>Visa</button><button type="button" className="demo-example" onClick={() => fillExample('MASTERCARD')}>Mastercard</button></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                <Field label="Test card number" required><Input name="testCardNumber" inputMode="numeric" autoComplete="off" data-lpignore="true" data-1p-ignore="true" maxLength={19} placeholder="0000 0000 0000 0000" value={testNumber} invalid={!!cardErrors.number} aria-invalid={!!cardErrors.number} aria-describedby="demo-card-number-help" required onChange={(event) => { setTestNumber(formatCardNumber(event.target.value)); setCardErrors((previous) => ({ ...previous, number: undefined })) }} /><span id="demo-card-number-help" className={`mt-2 block text-xs ${cardErrors.number ? 'text-tone-danger-400' : 'text-ink-300'}`} role={cardErrors.number ? 'alert' : undefined}>{cardErrors.number || 'Use only the supplied examples; never enter a real card.'}</span></Field>
                <Field label="Expiry" required><Input name="testCardExpiry" inputMode="numeric" autoComplete="off" data-lpignore="true" data-1p-ignore="true" maxLength={5} placeholder="MM/YY" value={testExpiry} invalid={!!cardErrors.expiry} aria-invalid={!!cardErrors.expiry} aria-describedby="demo-card-expiry-help" required onChange={(event) => { setTestExpiry(formatExpiry(event.target.value)); setCardErrors((previous) => ({ ...previous, expiry: undefined })) }} /><span id="demo-card-expiry-help" className={`mt-2 block text-xs ${cardErrors.expiry ? 'text-tone-danger-400' : 'text-ink-300'}`} role={cardErrors.expiry ? 'alert' : undefined}>{cardErrors.expiry || 'MM/YY'}</span></Field>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-ink-300"><ShieldCheck aria-hidden="true" className="size-4 shrink-0" />Card details stay in this page. No security code is collected.</p>
            </fieldset>
            <fieldset className="grid gap-4 border-t border-ink-700 pt-5 sm:grid-cols-2"><legend className="mb-4 font-semibold text-fg">Billing contact</legend>
              {contactFields.map(({ key, label, required, type }) => <Field key={key} label={label} required={required} error={fieldErrors[key]}>
                <Input name={key} type={type} maxLength={key === 'email' ? 254 : 160} value={contact[key]} invalid={!!fieldErrors[key]}
                  onChange={(event) => { setContact((previous) => ({ ...previous, [key]: event.target.value })); setFieldErrors((previous) => ({ ...previous, [key]: undefined })) }} />
              </Field>)}
              <Field label="Country"><Input value="Sri Lanka (LK)" readOnly /></Field>
            </fieldset>
            <Button className="min-h-12 w-full sm:w-auto" type="submit" variant="primary" loading={saving} disabled={saving}>Complete demo checkout <ArrowRight aria-hidden="true" className="size-4" /></Button>
          </form>}
        </div>
        <aside className="rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:p-7 lg:sticky lg:top-24">
          <span className="letterboard text-tone-cyan-300">02 / ORDER SUMMARY</span>
          <div className="mt-5"><DemoCardPreview number={testNumber} expiry={testExpiry} name={contact.fullName} /></div>
          <h2 className="font-marquee mt-6 text-xl font-bold text-fg">A month to explore.</h2>
          <p className="mt-2 text-sm text-ink-200">Your access begins on activation and ends after 30 days. Confirmation is queued for your account email and billing email (if different) after activation.</p>
          <div className="mt-7 flex justify-between gap-4 border-t border-ink-700 pt-5 text-sm"><span className="text-ink-200">Monthly subscription</span><span>LKR {plan.price}</span></div>
          <div className="mt-3 flex justify-between gap-4 text-sm"><strong className="text-fg">Simulated charge</strong><strong className="font-mono text-xl text-tone-cyan-300">LKR {plan.price}</strong></div>
          <p className="mt-3 text-xs text-ink-300">Test cards only · no real money charged · refundable simulation · no automatic renewal</p>
        </aside>
      </section>)}
    <Feedback error={submitError} />
    {activePassConflict && <Link to="/subscription" className={`${link} mt-3 inline-block`}>View your active subscription</Link>}
  </Page>
}
export function CheckoutResult() {
  const location = useLocation()
  const order = (location.state as { order?: OrderView } | null)?.order
  const refundableDemo = order?.method === 'DEMO_CARD' && order?.status === 'SIMULATED_APPROVED'
  const demo = order?.method === 'NO_CHARGE_TEST_CARD' || refundableDemo
  const active = refundableDemo || ((order?.method === 'COMPLIMENTARY' || demo) && order?.status === 'NO_CHARGE_ACTIVE')
  return <Page title={active ? (demo ? 'Demo checkout complete' : 'Subscription activated') : order ? 'Order recorded' : 'No checkout result to show'} notice={active ? (demo ? 'Demo complete · no money charged · no automatic renewal.' : 'Complimentary activation · LKR 0 due · no automatic renewal.') : 'View your order and subscription details.'}>
    {order ? <section data-activation-result className="billing-panel rounded-2xl border border-violet-400/30 bg-ink-850 p-6 sm:p-10">
      <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Check aria-hidden="true" /></div>
      <p className="letterboard mt-6 text-tone-cyan-300">{active ? 'ACCESS ACTIVATED' : 'ORDER UPDATE'}</p>
      <h2 className="font-marquee mt-2 text-2xl font-bold text-fg sm:text-3xl">{active ? 'Ready when you are.' : 'View your order details.'}</h2>
      <p className="mt-3 max-w-xl text-ink-200">{active ? (demo ? (refundableDemo ? 'Your 30-day access is active. This simulated card payment is refundable through billing history; no real money was charged.' : 'Your no-charge demo 30-day access is active. Amount due LKR 0; no payment was processed.') : 'Your complimentary 30-day access is active. Amount due LKR 0; no payment was processed.') : order.method === 'COMPLIMENTARY' ? 'Your activation request was recorded. Check your subscription for current access.' : 'A previous preview record, not a payment. Check your subscription for current access.'}</p>
      <div className="mt-7 flex flex-wrap gap-6 border-y border-ink-700 py-5 text-sm"><div><span className="block text-ink-300">Order</span><strong className="mt-1 block text-fg">#{order.id}</strong></div><div><span className="block text-ink-300">Status</span><strong className="mt-1 block text-fg">{orderLabel(order)}</strong></div>{active && <><div><span className="block text-ink-300">Listed monthly price</span><strong className="mt-1 block text-fg">LKR 500</strong></div><div><span className="block text-ink-300">{refundableDemo ? 'Simulated payment amount' : 'Amount due'}</span><strong className="mt-1 block text-fg">{refundableDemo ? `${order.currency ?? 'LKR'} ${order.amount ?? 'Not provided'}` : 'LKR 0'}</strong></div></>}</div>
      {order.reference && <p className="mt-4 break-all text-sm text-ink-200">Reference: {order.reference}</p>}
      {order.submittedAt && <p className="mt-2 text-sm text-ink-200">Recorded: {date(order.submittedAt)}</p>}
      {active && <p className="mt-4 text-sm text-ink-200">Confirmation queued for your account email and billing email (if different).</p>}
      {refundableDemo && <Link to="/billing" className="billing-action mt-7 mr-3">Request a demo refund <ArrowRight aria-hidden="true" className="size-4" /></Link>}
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
  return <Page wide title="Your subscription" notice="Your access, all in one place. No automatic renewal.">
    {loading && <p role="status">Loading subscription…</p>}
    <Feedback error={error} retry={retry} />
    {value && <div data-subscription-summary className="billing-panel billing-subscription-grid rounded-2xl border border-violet-400/30 bg-ink-850 p-6 sm:p-9"><div>
      <span className="letterboard text-tone-cyan-300">CURRENT ACCESS</span>
      <h2 className="font-marquee mt-3 text-2xl font-bold text-fg">{value.premium ? 'Premium access active' : 'No active premium pass'}</h2>
      <div className="mt-7 grid gap-5 border-t border-ink-700 pt-6 sm:grid-cols-3">
        <div><p className="letterboard text-ink-300">Plan</p><p className="mt-2 text-lg font-semibold text-fg">{planLabel(value.planName)}</p></div>
        <div><p className="letterboard text-ink-300">Status</p><p className="mt-2 text-lg font-semibold text-fg">{statusLabel(value.status)}</p></div>
        <div><p className="letterboard text-ink-300">Term</p><p className="mt-2 text-sm text-fg">{value.startDate || value.endDate ? <>{value.startDate && date(value.startDate)}{value.startDate && value.endDate && <br />}{value.endDate && <>through {date(value.endDate)}</>}</> : 'No current term'}</p></div>
      </div>
      <p className="mt-5 text-ink-200">{value.adFree ? 'Ad-free viewing is active until this pass ends.' : 'You can keep watching the free collection, with advertisements.'}</p>
      {value.premium && <div className="mt-6 border-t border-ink-700 pt-5"><p className="mb-3 text-sm">Canceling ends access immediately; cancellation does not request a refund. For a simulated card payment, request a refund separately in billing history. No payment or refund occurs for a no-charge pass.</p>
        <Button variant="danger" loading={busy} disabled={busy} onClick={async () => {
          if (actor == null || busy || !window.confirm('Cancel this subscription immediately? Access ends now.')) return
          setBusy(true); setActionError(null)
          try { await billing.cancel(actor); await refreshAccount().catch(() => undefined); retry() }
          catch (cause) { setActionError(message(cause)) } finally { setBusy(false) }
        }}>Cancel immediately</Button>
      </div>}
      <div className="mt-6 flex flex-wrap gap-3"><Link className="billing-action" to={value.premium ? '/browse' : '/plans'}>{value.premium ? 'Find something to watch' : 'Explore the monthly pass'}<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
      <Feedback error={actionError} />
    </div><aside className="billing-subscription-pass"><MembershipPass /><p className="mt-4 text-center text-sm text-ink-300">{value.premium ? 'Your membership, your time.' : 'A little preview of your next chapter.'}</p></aside></div>}
    <section className="mt-8" aria-labelledby="subscription-orders-heading">
      <div className="billing-section-heading"><div><h2 id="subscription-orders-heading" className="text-xl font-bold">Subscription orders</h2><p className="mt-1 text-sm text-ink-300">Records of requests, not your current access status.</p></div><Button size="sm" onClick={() => { orders.retry(); retry() }}>Refresh</Button></div>
      {orders.loading ? <p role="status" className="mt-4">Loading orders…</p> : orders.error ? <Feedback error={orders.error} retry={orders.retry} />
        : orders.value?.length ? <details className="billing-history mt-4"><summary>View order history <span className="billing-badge">{orders.value.length} records</span></summary>
          <p className="px-5 pt-4 text-sm text-ink-300">Complimentary and older no-charge demo activations cost LKR 0. Simulated card payments record a refundable demo amount. No real money moved.</p>
          <ul className="grid gap-4 p-5 md:grid-cols-2">{[...orders.value].sort((a, b) => b.id - a.id).map((order) => <OrderRecord key={order.id} order={order} />)}</ul>
        </details> : <div className="billing-order mt-4"><h3>No orders yet</h3><p className="mt-2 text-sm text-ink-300">When you activate a pass, your record will appear here.</p></div>}
    </section>
    <section className="billing-history-nav mt-6"><div><h2 className="font-semibold text-fg">Looking for earlier billing activity?</h2><p className="mt-2 text-sm text-ink-300">Previous simulated records and refund requests are kept separately.</p></div><Link className="billing-action billing-action-secondary" to="/billing">Billing history &amp; refunds <ArrowRight aria-hidden="true" className="size-4" /></Link></section>
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

  useEffect(() => {
    if (actor == null) return
    const refresh = () => setRevision((n) => n + 1)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [actor])

  const notifyRefundChange = () => {
    window.dispatchEvent(new Event('skopia:refunds-changed'))
    window.dispatchEvent(new Event('skopia:notifications-changed'))
  }
  const openRefund = (payment: DemoPayment) => {
    setSelected(payment); setCategory('ACCIDENTAL_PURCHASE'); setReason(''); setReasonError(null)
  }
  const submitRefund = async () => {
    if (actor == null || selected == null || saving || refunds?.some((request) => request.paymentId === selected.id)) return
    const validation = validateRefundReason(reason)
    setReasonError(validation)
    if (validation) return
    setSaving(true)
    try {
      await billing.requestRefund(selected.id, category, reason, actor)
      toast({ title: 'Refund request submitted · confirmation email queued', tone: 'ok' })
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

  return <Page title="Demo billing history" notice="Demo payments and refunds are simulated; no real money moves.">
    <div className="billing-section-heading mb-4"><p className="text-sm text-ink-300">Track your refund here. Status refreshes when you return to this page.</p><Button size="sm" disabled={loading} onClick={() => setRevision((n) => n + 1)}>Refresh</Button></div>
    {loading && <p role="status">Loading demo records…</p>}
    <Feedback error={error} retry={() => setRevision((n) => n + 1)} />
    {payments && refunds && (payments.length === 0 ? <p>No demo payment records yet.</p> : <ul className="space-y-3">{payments.map((payment) => {
      const request = refunds.find((item) => item.paymentId === payment.id)
      const check = eligibility[payment.id]
      return <li key={payment.id} className={box}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-fg">{planLabel(payment.planName)} · {payment.payStatus === 'SIMULATED_APPROVED' ? 'Simulated payment approved' : payment.payStatus ?? 'Status unknown'}</p>
            <p className="mt-2 text-sm text-ink-300">Simulated payment: {request?.currency ?? payment.currency ?? 'LKR'} {payment.amount}</p>
            <p className="text-sm text-ink-300">{date(payment.paidDatetime)} · {payment.payMethod ?? 'Method not specified'}</p>
            {(payment.cardBrand || payment.cardLast4) && <p className="text-sm text-ink-300">Synthetic {payment.cardBrand ?? 'card'} ending {payment.cardLast4 ?? '—'}</p>}
            {!request && check && <p className={`mt-2 text-xs ${check.eligible ? 'text-tone-cyan-300' : 'text-ink-400'}`}>{check.eligible ? `Eligible for ${check.windowDays} days${check.eligibleUntil ? `, until ${date(check.eligibleUntil)}` : ''}.` : `Not eligible: ${check.reason.replaceAll('_', ' ').toLowerCase()}.`}</p>}
          </div>
          {request ? <span className="letterboard rounded border border-gold-400/40 px-2 py-1 text-tone-gold-300">Refund {request.status.toLowerCase()}</span>
            : <Button size="sm" disabled={!check?.eligible} title={!check?.eligible ? 'This payment is not eligible for a refund.' : undefined} onClick={() => openRefund(payment)}>Request refund</Button>}
        </div>
        {request && <div className="mt-4 border-t border-ink-700 pt-3 text-sm text-ink-300">
          <p><span className="text-ink-100">Category:</span> {request.category?.replaceAll('_', ' ') ?? 'Not specified'}</p>
          <p><span className="text-ink-100">Reason:</span> {request.reason}</p>
          <p><span className="text-ink-100">Refund amount:</span> {request.currency ?? payment.currency ?? 'LKR'} {request.amount ?? payment.amount} {request.simulation && '· simulated'}</p>
          <p className="mt-2 text-ink-100">{request.status === 'PENDING' ? 'Awaiting administrator review. Request confirmation queued for your email.' : request.status === 'APPROVED' ? 'Simulated refund approved. Approval confirmation queued for your email; no real money moves.' : request.status === 'REJECTED' ? 'Refund request rejected. This payment cannot have another refund request.' : request.status === 'CANCELLED' ? 'Refund request cancelled. This payment cannot have another refund request.' : 'Check refund history for details.'}</p>
          {request.eligibleUntil && <p><span className="text-ink-100">Eligible until:</span> {date(request.eligibleUntil)}</p>}
          {request.processingNote && <p className="mt-1"><span className="text-ink-100">Decision note:</span> {request.processingNote}</p>}
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="quiet" onClick={() => void showHistory(request)}>View history</Button>{request.status === 'PENDING' && <Button size="sm" variant="danger" loading={saving} onClick={() => void cancelRefund(request)}>Cancel request</Button>}</div>
        </div>}
      </li>
    })}</ul>)}
    <Modal open={selected != null} onClose={() => !saving && setSelected(null)} title="Request a demo refund" description="Choose the category that best describes the request. Each payment can have only one refund request, even after cancellation. This is a simulation; no real money moves. Confirmation email is queued on request and approval, not guaranteed delivered."
      footer={<><Button variant="quiet" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button><Button loading={saving} onClick={() => void submitRefund()}>Submit request</Button></>}>
      {selected && <div className="space-y-4">
        <p className="text-sm text-ink-300">Payment #{selected.id} · {selected.planName ?? 'Demo pass'} · refund amount {selected.currency ?? 'LKR'} {selected.amount}</p>
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
