import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Play, Check } from 'lucide-react'
import { Button, Field, Input, Checkbox } from '@/components/primitives'
import { PosterPlate, Lightbox, BillingBoard, MarqueeRule, Letterboard } from '@/components/world'
import { Wordmark, useSession } from '@/components/Shell'
import { VIDEOS, CATEGORIES, GENRES, fmt } from '@/lib/data'

/* =============================================================== the lobby */

export function Lobby() {
  const headline = VIDEOS[0]
  const support = [VIDEOS[3], VIDEOS[7]]
  const tail = VIDEOS.slice(1).filter((v) => !support.includes(v) && v.billing !== 'PULLED')

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-20 max-w-[1500px] items-center px-4 sm:px-6 lg:px-8">
        <Wordmark />
        <nav className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="rounded-sm px-3 py-2 text-[14px] font-medium text-ink-200 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Button variant="primary" onClick={() => (window.location.href = '/browse')}>
            Start watching
          </Button>
        </nav>
      </header>
      <MarqueeRule />

      {/* ---- first viewport: billing block + one live lightbox ---- */}
      <section className="mx-auto max-w-[1500px] px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.9fr_1fr] lg:gap-14">
          {/* billing block — hierarchy by size and span, never a uniform grid */}
          <div className="min-w-0">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <BillingBoard billing={headline.billing} />
                <Letterboard tone="neutral">{headline.category}</Letterboard>
                {headline.premium && <Letterboard tone="held">Season Pass</Letterboard>}
              </div>
              <Link to={`/watch/${headline.id}`} className="group block">
                <h1 className="font-marquee text-[clamp(2.75rem,8.5vw,5.75rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-white">
                  {headline.title}
                </h1>
              </Link>
              <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-ink-200">
                {headline.synopsis}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-300">
                <span>{headline.creator}</span>
                <span aria-hidden>·</span>
                <span className="font-mono tabular-nums">{headline.runtime}</span>
                <span aria-hidden>·</span>
                <span className="font-mono tabular-nums">{fmt(headline.views)} views</span>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Play className="size-4 fill-current" />}
                  onClick={() => (window.location.href = `/watch/${headline.id}`)}
                >
                  Play now
                </Button>
                <Button size="lg" onClick={() => (window.location.href = '/browse')}>
                  See the whole programme
                </Button>
              </div>
            </div>

            {/* supporting billing — roughly half scale */}
            <div className="mt-12 grid gap-6 border-t border-ink-800 pt-8 sm:grid-cols-2">
              {support.map((v) => (
                <div key={v.id}>
                  <BillingBoard billing={v.billing} />
                  <Link to={`/watch/${v.id}`}>
                    <h2 className="font-marquee mt-2.5 text-[clamp(1.5rem,3.4vw,2.4rem)] font-bold leading-[1.02] tracking-[-0.03em] text-white hover:text-violet-200">
                      {v.title}
                    </h2>
                  </Link>
                  <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink-300">
                    {v.synopsis}
                  </p>
                </div>
              ))}
            </div>

            {/* the long tail — a dense justified block at the foot */}
            <div className="mt-10 border-t border-ink-800 pt-6">
              <p className="letterboard mb-3 text-ink-300">Also in the programme</p>
              <p className="max-w-[80ch] text-justify text-[15px] leading-[1.9] text-ink-300 [text-wrap:pretty]">
                {tail.map((v, i) => (
                  <span key={v.id}>
                    <Link
                      to={`/watch/${v.id}`}
                      className="font-marquee font-semibold text-ink-100 decoration-violet-500/50 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                      {v.title}
                    </Link>
                    <span className="text-ink-300"> · {v.creator}</span>
                    {i < tail.length - 1 && <span className="text-ink-300">   /   </span>}
                  </span>
                ))}
              </p>
            </div>
          </div>

          {/* one live lightbox */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <Lightbox>
              <Link to={`/watch/${headline.id}`} className="block aspect-video">
                <PosterPlate
                  title={headline.title}
                  creator={headline.creator}
                  runtime={headline.runtime}
                  seed={headline.seed}
                />
              </Link>
            </Lightbox>
            <div className="mt-3 flex items-center justify-between gap-3">
              <BillingBoard billing={headline.billing} />
              <span className="font-mono text-[12px] tabular-nums text-ink-300">
                {headline.runtime}
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-300">
              Placeholder artwork. Real poster imagery replaces these plates at production.
            </p>
          </aside>
        </div>
      </section>

      {/* ---- what the platform carries ---- */}
      <section className="border-t border-ink-800">
        <div className="mx-auto max-w-[1500px] px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-marquee text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-tight text-white">
            A venue, not a feed
          </h2>
          <p className="mt-3 max-w-[68ch] text-[16px] leading-relaxed text-ink-300">
            Skopia carries the whole operation in one place — the programme and its playback,
            passes and payment, reports and their resolution, notifications, advertising, and the
            consoles the staff run it from. What you can reach depends on your role.
          </p>
          <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Browse and watch', 'Search by category, genre and popularity. Play with full controls, captions, and your place kept.'],
              ['Passes and payment', 'Claim a pass, change it, or let it go. Every payment leaves a receipt you can find again.'],
              ['Report and track', 'Report a title or a playback fault, then follow it through to a resolution you can read.'],
              ['Notifications', 'New titles, pass changes, and report outcomes — only the kinds you asked for.'],
              ['Advertising', 'Campaigns run to a schedule against chosen categories, and always say they are advertising.'],
              ['Administration', 'Accounts, roles, moderation, plans, announcements, logs and configuration.'],
            ].map(([t, d]) => (
              <div key={t}>
                <h3 className="font-marquee text-[17px] font-bold text-white">{t}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-300">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ink-800">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-12 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <h2 className="font-marquee text-[26px] font-bold text-white">Doors are open.</h2>
            <p className="mt-1.5 text-[15px] text-ink-300">
              Browsing is free. A pass adds the premium programme and removes advertising.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 sm:ml-auto">
            <Button variant="primary" size="lg" icon={<ArrowRight className="size-4" />}
              onClick={() => (window.location.href = '/signup')}>
              Create an account
            </Button>
            <Button size="lg" onClick={() => (window.location.href = '/plans')}>
              See passes
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-800">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-4 py-8 text-[13px] text-ink-300 sm:px-6 lg:px-8">
          <Wordmark />
          <span>Watch beyond limits.</span>
          <span className="ml-auto font-mono text-[12px]">SE2030 · 26-MTR-SE2030-14</span>
        </div>
      </footer>
    </div>
  )
}

/* ================================================================== shared */

function AuthFrame({
  title,
  lede,
  children,
  foot,
}: {
  title: string
  lede: string
  children: React.ReactNode
  foot: React.ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-8 sm:px-8 lg:px-14">
        <Wordmark />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-marquee text-[clamp(1.9rem,4vw,2.5rem)] font-extrabold leading-tight tracking-[-0.03em] text-white">
            {title}
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-ink-300">{lede}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-[13.5px] text-ink-300">{foot}</div>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-ink-800 bg-inset lg:block">
        <div className="absolute inset-0 opacity-70">
          <PosterPlate title="" seed={3} compact />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <Letterboard tone="live">Now showing</Letterboard>
          <p className="font-marquee mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.03em] text-white">
            {VIDEOS[0].title}
          </p>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-300">
            {VIDEOS[0].synopsis}
          </p>
        </div>
      </aside>
    </div>
  )
}

/* ================================================================== log in */

export function Login() {
  const nav = useNavigate()
  const { setRole } = useSession()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return setErr('Enter the email address you registered with.')
    if (pw.length < 4) return setErr('That password is too short to be one of ours.')
    setErr('')
    setBusy(true)
    window.setTimeout(() => {
      setRole('viewer')
      nav('/browse')
    }, 700)
  }

  return (
    <AuthFrame
      title="Welcome back"
      lede="Sign in to pick up where you stopped watching."
      foot={
        <>
          No account yet?{' '}
          <Link to="/signup" className="text-violet-300 underline hover:text-violet-200">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" required error={err && !email.includes('@') ? err : undefined}>
          <Input
            type="email"
            value={email}
            autoComplete="email"
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!err && !email.includes('@')}
          />
        </Field>
        <Field
          label="Password"
          required
          error={err && email.includes('@') ? err : undefined}
          hint=""
        >
          <Input
            type="password"
            value={pw}
            autoComplete="current-password"
            placeholder="••••••••"
            onChange={(e) => setPw(e.target.value)}
            invalid={!!err && email.includes('@')}
          />
        </Field>
        <div className="flex items-center justify-between">
          <Checkbox checked label="Keep me signed in" onChange={() => {}} />
          <Link to="/reset" className="text-[13px] text-ink-300 hover:text-white">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthFrame>
  )
}

/* ================================================================= sign up */

export function Signup() {
  const nav = useNavigate()
  return (
    <AuthFrame
      title="Create your account"
      lede="Browsing is free. A pass adds the premium programme and removes advertising."
      foot={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-violet-300 underline hover:text-violet-200">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          nav('/onboarding')
        }}
      >
        <Field label="Display name" required>
          <Input placeholder="How you appear on comments" autoComplete="name" />
        </Field>
        <Field label="Email" required>
          <Input type="email" placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password" required hint="At least 8 characters">
          <Input type="password" placeholder="••••••••" autoComplete="new-password" />
        </Field>
        <Checkbox checked={false} onChange={() => {}} label="Email me about new titles and platform news" />
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Create account
        </Button>
      </form>
    </AuthFrame>
  )
}

/* =========================================================== reset password */

export function ResetPassword() {
  const [sent, setSent] = useState(false)
  return (
    <AuthFrame
      title={sent ? 'Check your inbox' : 'Reset your password'}
      lede={
        sent
          ? 'If that address has an account, a reset link is on its way. The link expires in one hour.'
          : 'Enter your email address and we will send you a link to set a new password.'
      }
      foot={
        <Link to="/login" className="text-violet-300 underline hover:text-violet-200">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-center gap-3 rounded-sm border border-success-500/35 bg-success-500/8 px-4 py-3.5 text-[14px] text-success-400">
          <Check className="size-4 shrink-0" />
          Reset link sent.
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setSent(true)
          }}
        >
          <Field label="Email" required>
            <Input type="email" placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthFrame>
  )
}

/* =============================================================== onboarding */

export function Onboarding() {
  const nav = useNavigate()
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (g: string) =>
    setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]))

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 sm:px-6">
      <Wordmark />
      <div className="py-12">
        <p className="letterboard text-ink-300">Step 1 of 1</p>
        <h1 className="font-marquee mt-2 text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight tracking-[-0.03em] text-white">
          What should we put in front of you?
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-ink-300">
          Pick anything that interests you. Recommendations use these alongside what you actually
          watch — you can change them whenever you like.
        </p>

        <fieldset className="mt-8">
          <legend className="letterboard mb-3 text-ink-300">Categories</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} on={picked.includes(c)} onClick={() => toggle(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className="letterboard mb-3 text-ink-300">Genres</legend>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <Chip key={g} on={picked.includes(g)} onClick={() => toggle(g)}>
                {g}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={() => nav('/browse')}>
            {picked.length ? `Continue with ${picked.length} selected` : 'Continue'}
          </Button>
          <Button variant="quiet" size="lg" onClick={() => nav('/browse')}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={
        on
          ? 'rounded-sm border border-violet-400 bg-violet-500/18 px-3.5 py-2 text-[14px] font-medium text-violet-100 transition-colors'
          : 'rounded-sm border border-ink-600 bg-ink-850 px-3.5 py-2 text-[14px] text-ink-200 transition-colors hover:border-ink-500 hover:text-white'
      }
    >
      {children}
    </button>
  )
}
