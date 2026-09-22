/**
 * Passes and billing.
 *
 * Nothing on the server records a plan, a payment or a subscription — there is
 * no billing module on any branch. These screens therefore sell nothing and
 * claim nothing: no card is collected, no pass is reported as held, and no
 * transaction is listed. What is shown is what the passes are intended to
 * include, which is product intent rather than a fact about anybody's account.
 *
 * When a billing backend lands, the tiers below become its response and the
 * purchase path returns to this file.
 */

import { Link } from 'react-router-dom'
import { Check, CreditCard, Receipt, Ticket } from 'lucide-react'
import { NotAvailableYet } from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { FrontOfHouse } from '@/components/Shell'
import { PLANS } from '@/lib/data'

/* ================================================================== plans */

export function Plans() {
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-marquee text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          Passes
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-300">
          Browsing and the free programme need no pass. A pass adds the premium programme and
          removes advertising.
        </p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-850 px-3 py-2">
          <Letterboard tone="soon">Not on sale yet</Letterboard>
          <span className="text-[13px] text-ink-300">
            Pricing is not set and no payment can be taken.
          </span>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.id} className="flex flex-col rounded-lg border border-ink-700 bg-ink-850 p-6">
              <h2 className="font-marquee text-[20px] font-bold text-white">{p.name}</h2>
              <p className="mt-1.5 text-[13px] text-ink-400">Price not yet set</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.entitlements.map((e) => (
                  <li key={e} className="flex items-start gap-2 text-[13.5px] text-ink-200">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success-400" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[13px] text-ink-400">
          Everything in the free programme is already available —{' '}
          <Link to="/browse" className="text-cyan-300 underline hover:text-cyan-200">
            start watching
          </Link>
          .
        </p>
      </div>
    </FrontOfHouse>
  )
}

/* =============================================================== checkout */

/**
 * Buying a pass.
 *
 * <p>This used to be a three-step wizard that collected a card number and,
 * after a timer, announced success. Nothing was charged and nothing was stored.
 * A form that looks like it takes a payment is the one piece of scaffolding
 * that could do real harm, so it is gone rather than disabled.
 */
export function Checkout() {
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <NotAvailableYet
          what="Buying a pass"
          icon={<CreditCard className="size-7" />}
          body="No payment can be taken yet — there is nothing on the server to record one
            against. When passes go on sale this is where the purchase happens."
          action={
            <Link to="/plans" className="text-[13px] text-cyan-300 underline hover:text-cyan-200">
              See what the passes will include
            </Link>
          }
        />
      </div>
    </FrontOfHouse>
  )
}

export function CheckoutResult() {
  return <Checkout />
}

/* =========================================================== subscription */

export function Subscription() {
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-marquee text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          Your pass
        </h1>
        <div className="mt-7">
          <NotAvailableYet
            what="Your pass"
            icon={<Ticket className="size-7" />}
            body="Passes are not on sale yet, so no account holds one. Once they are, this shows
              which pass you hold, when it renews and how to stop it."
            action={
              <Link to="/plans" className="text-[13px] text-cyan-300 underline hover:text-cyan-200">
                See the passes
              </Link>
            }
          />
        </div>
      </div>
    </FrontOfHouse>
  )
}

/* ======================================================== billing history */

export function BillingHistory() {
  return (
    <FrontOfHouse>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="font-marquee text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.03em] text-white">
          Billing history
        </h1>
        <div className="mt-7">
          <NotAvailableYet
            what="Billing history"
            icon={<Receipt className="size-7" />}
            body="Every payment taken from your account will be listed here with its receipt. No
              payment has been taken from anyone yet, so the list is genuinely empty."
          />
        </div>
      </div>
    </FrontOfHouse>
  )
}
