import { ThemeSelect } from '@/components/ThemeSelect'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Play, Check } from 'lucide-react'
import { Button, Field, Input, Checkbox } from '@/components/primitives'
import { PosterPlate, Lightbox, BillingBoard, MarqueeRule, Letterboard } from '@/components/world'
import { Wordmark, useSession } from '@/components/Shell'
import { Tile } from './viewer'
import { GENRES, fmt } from '@/lib/data'
import { useCatalogue } from '@/lib/useCatalogue'
import { homeFor } from '@/lib/session'
import { accounts, ApiError } from '@/lib/accounts'

/* =============================================================== the lobby */

export function Lobby() {
  const nav = useNavigate()
  // The landing page is the real catalogue, read without an account, because
  // browsing needs none. An empty or unreachable catalogue simply means no
  // shelves — the page above them still stands on its own.
  const { videos, categories } = useCatalogue()
  const headline = videos[0]
  const support = [videos[3], videos[7]].filter(Boolean)
  // The justified tail is a typographic device, not a listing. Past a dozen or so
  // it stops reading as a block of type and becomes a wall; the shelves below
  // carry the rest.
  const tail = videos
    .slice(1)
    .filter((v) => !support.includes(v) && v.billing === 'NOW SHOWING')
    .slice(0, 12)

  // Only what is actually playable appears: a title still in review or not yet
  // released is not the guest's business, and a shelf with one item on it looks
  // worse than no shelf at all.
  const shelves = categories.map(({ name }) => ({
    category: name,
    items: videos.filter(
      (v) => v.category === name && (v.billing === 'NOW SHOWING' || v.billing === 'HELD OVER'),
    ).slice(0, 5),
  })).filter((s) => s.items.length >= 3)

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex min-h-20 max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Wordmark />
        <nav className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeSelect />
          <Link
            to="/login"
            className="rounded-sm px-3 py-2 text-[14px] font-medium text-ink-200 transition-colors hover:text-fg"
          >
            Sign in
          </Link>
          <Button variant="primary" onClick={() => nav('/browse')}>
            Start watching
          </Button>
        </nav>
      </header>
      <MarqueeRule />

      {/* ---- first viewport: billing block + one live lightbox ----
           The billing block bills a real title, so with nothing in the catalogue
           there is nothing to bill and the section stands down rather than
           rendering a headline that is not there. ---- */}
      {headline && (
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
                <h1 className="font-marquee text-[clamp(2.75rem,8.5vw,5.75rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-fg">
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
                  onClick={() => nav(`/watch/${headline.id}`)}
                >
                  Play now
                </Button>
                <Button size="lg" onClick={() => nav('/browse')}>
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
                    <h2 className="font-marquee mt-2.5 text-[clamp(1.5rem,3.4vw,2.4rem)] font-bold leading-[1.02] tracking-[-0.03em] text-fg hover:text-tone-violet-200">
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
                      className="font-marquee font-semibold text-ink-100 decoration-violet-500/50 underline-offset-4 transition-colors hover:text-fg hover:underline"
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
            <Lightbox interactive>
              <Link to={`/watch/${headline.id}`} className="block aspect-video">
                <PosterPlate
                  title={headline.title}
                  creator={headline.creator}
                  runtime={headline.runtime}
                  seed={headline.seed} category={headline.category}
                  thumbnailUrl={headline.thumbnailUrl}
                />
              </Link>
            </Lightbox>
            <div className="mt-3 flex items-center justify-between gap-3">
              <BillingBoard billing={headline.billing} />
              <span className="font-mono text-[12px] tabular-nums text-ink-300">
                {headline.runtime}
              </span>
            </div>
          </aside>
        </div>
      </section>
      )}

      {/* ---- the programme itself: a guest browses before signing up ---- */}
      {shelves.map(({ category, items }) => (
        <section key={category} className="border-t border-ink-800">
          <div className="mx-auto max-w-[1500px] px-4 py-11 sm:px-6 lg:px-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-marquee text-[clamp(1.3rem,2.4vw,1.75rem)] font-bold tracking-[-0.02em] text-fg">
                {category}
              </h2>
              <Link
                to={`/category/${encodeURIComponent(category)}`}
                className="group flex shrink-0 items-center gap-1.5 text-[13px] text-ink-300 transition-colors hover:text-fg"
              >
                All {category.toLowerCase()}
                <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((v) => (
                <Tile key={v.id} v={v} size="sm" />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="border-t border-ink-800">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-12 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <h2 className="font-marquee text-[26px] font-bold text-fg">Doors are open.</h2>
            <p className="mt-1.5 text-[15px] text-ink-300">
              Browsing is free. A pass adds the premium programme and removes advertising.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 sm:ml-auto">
            <Button variant="primary" size="lg" icon={<ArrowRight className="size-4" />}
              onClick={() => nav('/signup')}>
              Create an account
            </Button>
            <Button size="lg" onClick={() => nav('/plans')}>
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
  // The panel beside the form bills a real title, so it is right rather than
  // decorative. With nothing in the catalogue the panel simply has no billing.
  const { videos } = useCatalogue()
  const showing = videos.find((v) => v.billing === 'NOW SHOWING')
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-8 sm:px-8 lg:px-14">
        <div className="flex items-center justify-between gap-3"><Wordmark /><ThemeSelect /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-marquee text-[clamp(1.9rem,4vw,2.5rem)] font-extrabold leading-tight tracking-[-0.03em] text-fg">
            {title}
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-ink-300">{lede}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-[13.5px] text-ink-300">{foot}</div>
        </div>
      </div>
      <aside className="theme-media relative hidden overflow-hidden border-l border-ink-800 bg-inset lg:block">
        <div className="absolute inset-0 opacity-70">
          <PosterPlate title="" seed={3} compact thumbnailUrl={showing?.thumbnailUrl} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
        {showing && (
          <div className="absolute inset-x-0 bottom-0 p-10">
            <Letterboard tone="live">Now showing</Letterboard>
            <p className="font-marquee mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.03em] text-fg">
              {showing.title}
            </p>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-300">
              {showing.synopsis}
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}

/* ================================================================== log in */

export function Login() {
  const nav = useNavigate()
  const { signIn } = useSession()
  const [identifier, setIdentifier] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return setErr('Enter your email address or handle.')
    if (!pw) return setErr('Enter your password.')
    setErr('')
    setBusy(true)
    try {
      // The server decides who this is and what the account holds. Nothing about
      // the answer is chosen here, which is the whole point of asking.
      const account = await signIn(identifier.trim(), pw)
      nav(homeFor(account))
    } catch (cause) {
      // A refusal and an unreachable API both arrive as ApiError, and both are
      // worth saying plainly rather than leaving the form looking broken.
      setErr(cause instanceof ApiError ? cause.message : 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      title="Welcome back"
      lede="Sign in to pick up where you stopped watching."
      foot={
        <>
          No account yet?{' '}
          <Link to="/signup" className="text-tone-violet-300 underline hover:text-tone-violet-200">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email or handle" required>
          <Input
            value={identifier}
            autoComplete="username"
            placeholder="you@example.com or @handle"
            onChange={(e) => setIdentifier(e.target.value)}
            invalid={!!err}
          />
        </Field>
        <Field label="Password" required>
          <Input
            type="password"
            value={pw}
            autoComplete="current-password"
            placeholder="••••••••"
            onChange={(e) => setPw(e.target.value)}
            invalid={!!err}
          />
        </Field>
        {err && (
          <p role="alert" className="text-[13px] text-tone-danger-400">
            {err}
          </p>
        )}
        <div className="flex items-center justify-between">
          <Checkbox checked label="Keep me signed in" onChange={() => {}} />
          <Link to="/reset" className="text-[13px] text-ink-300 hover:text-fg">
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
  const { signUp } = useSession()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [creator, setCreator] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // The handle is checked as it is typed because finding out it is taken after
  // filling in everything else is the worst moment to be told.
  const [taken, setTaken] = useState<boolean | null>(null)
  useEffect(() => {
    const clean = handle.trim().replace(/^@/, '')
    if (clean.length < 3) {
      setTaken(null)
      return
    }
    const timer = window.setTimeout(() => {
      accounts
        .handleAvailable(clean)
        .then((r) => setTaken(!r.available))
        .catch(() => setTaken(null))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [handle])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = handle.trim().replace(/^@/, '')
    if (!firstName.trim()) return setErr('Enter your first name.')
    if (clean.length < 3) return setErr('Pick a handle of at least three characters.')
    if (!email.includes('@')) return setErr('Enter an email address we can reach you at.')
    if (pw.length < 8) return setErr('Use a password of at least eight characters.')
    if (new TextEncoder().encode(pw).length > 72) return setErr('Password must not exceed 72 UTF-8 bytes.')
    setErr('')
    setBusy(true)
    try {
      await signUp({
        username: clean,
        email: email.trim(),
        password: pw,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        // A display name is what others see; the legal name is not. Falling back
        // to the first name rather than the handle is the kinder default, and
        // the profile page can change it later.
        displayName: name.trim() || firstName.trim() || clean,
        roleType: creator ? 'CONTENT_CREATOR' : 'REGISTERED_VIEWER',
      })
      nav('/onboarding')
    } catch (cause) {
      setErr(cause instanceof ApiError ? cause.message : 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      title="Create your account"
      lede="Browsing is free. A pass adds the premium programme and removes advertising."
      foot={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-tone-violet-300 underline hover:text-tone-violet-200">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required>
            <Input
              value={firstName}
              placeholder="Madhusara"
              autoComplete="given-name"
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Last name">
            <Input
              value={lastName}
              placeholder="Jayasinghe"
              autoComplete="family-name"
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Display name" hint="Defaults to your first name">
          <Input
            value={name}
            placeholder="How you appear on comments"
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Handle"
          required
          hint="Letters and numbers, at least three."
          error={taken ? `@${handle.trim().replace(/^@/, '')} is already taken.` : undefined}
        >
          <Input
            value={handle}
            placeholder="@yourhandle"
            autoComplete="username"
            invalid={taken === true}
            onChange={(e) => setHandle(e.target.value)}
          />
        </Field>
        <Field label="Email" required>
          <Input
            type="email"
            value={email}
            placeholder="you@example.com"
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" required hint="8–72 UTF-8 bytes">
          <Input
            type="password"
            maxLength={72}
            value={pw}
            placeholder="••••••••"
            autoComplete="new-password"
            onChange={(e) => setPw(e.target.value)}
          />
        </Field>
        <Checkbox
          checked={creator}
          onChange={setCreator}
          label="I want to publish videos — open a channel for me"
        />
        {err && (
          <p role="alert" className="text-[13px] text-tone-danger-400">
            {err}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          disabled={taken === true}
          className="w-full"
        >
          Create account
        </Button>
      </form>
    </AuthFrame>
  )
}

/* =========================================================== reset password */

const signInLink = (
  <Link to="/login" className="text-tone-violet-300 underline hover:text-tone-violet-200">
    Back to sign in
  </Link>
)

export function ResetPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const address = email.trim()
    if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setErr('Enter a valid email address.')
      return
    }
    setErr('')
    setBusy(true)
    try {
      await accounts.requestPasswordReset(address)
      setSent(true)
    } catch (cause) {
      // Do not repeat server text: even an error must not identify an account.
      setErr(cause instanceof ApiError && cause.status === 429
        ? 'Too many requests. Please wait before trying again.'
        : 'Could not request a reset link. Please try again later.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      title={sent ? 'Check your inbox' : 'Reset your password'}
      lede={sent
        ? 'If the address is registered and delivery succeeds, a link will arrive. Check your email for its expiry time.'
        : 'Enter your email address to request a link to set a new password.'}
      foot={signInLink}
    >
      {sent ? (
        <div role="status" className="flex items-center gap-3 rounded-sm border border-success-500/35 bg-success-500/8 px-4 py-3.5 text-[14px] text-tone-success-400">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          If the address is registered and delivery succeeds, a link will arrive.
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field label="Email" required>
            <Input type="email" placeholder="you@example.com" autoComplete="email" value={email}
              aria-invalid={!!err} aria-describedby={err ? 'reset-request-error' : undefined}
              onChange={(e) => setEmail(e.target.value)} invalid={!!err} />
          </Field>
          {err && <p id="reset-request-error" role="alert" className="text-[13px] text-tone-danger-400">{err}</p>}
          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthFrame>
  )
}

// The first inline head script removes the token from the URL before asset loading.
// Consume its in-memory slot once, retaining it across StrictMode's second initializer.
let capturedResetToken: string | null = null
type ResetTokenWindow = Window & { __skopiaResetToken?: string | null }
function takeResetToken(): string | null {
  const slot = window as ResetTokenWindow
  if (slot.__skopiaResetToken) capturedResetToken = slot.__skopiaResetToken
  delete slot.__skopiaResetToken
  return capturedResetToken
}

export function ConfirmPasswordReset() {
  const [token] = useState(takeResetToken)
  useEffect(() => () => {
    capturedResetToken = null
    delete (window as ResetTokenWindow).__skopiaResetToken
  }, [])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !token) return
    if (password.length < 8) return setErr('Use a password of at least eight characters.')
    if (new TextEncoder().encode(password).length > 72) return setErr('Password must not exceed 72 UTF-8 bytes.')
    if (password !== confirmation) return setErr('Passwords must match.')
    setErr('')
    setBusy(true)
    try {
      await accounts.confirmPasswordReset(token, password)
      capturedResetToken = null
      setPassword('')
      setConfirmation('')
      setDone(true)
    } catch (cause) {
      // Do not echo a backend message: it may include the single-use token.
      setErr(cause instanceof ApiError && cause.status === 0
        ? 'Could not reach Skopia. Please try again.'
        : 'This reset link is invalid, expired or already used. Request a new one.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame title={done ? 'Password updated' : 'Set a new password'}
      lede={done
        ? 'Your password has been changed. Sign in with your new password.'
        : 'Choose a new password for your account.'}
      foot={done ? signInLink : <Link to="/reset" className="text-tone-violet-300 underline hover:text-tone-violet-200">Request a new link</Link>}
    >
      {done ? (
        <div role="status" className="flex items-center gap-3 rounded-sm border border-success-500/35 bg-success-500/8 px-4 py-3.5 text-[14px] text-tone-success-400">
          <Check className="size-4 shrink-0" aria-hidden="true" /> Password updated.
        </div>
      ) : !token ? (
        <p role="alert" className="text-[14px] text-tone-danger-400">This reset link is invalid or expired. Request a new one.</p>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field label="New password" required hint="8+ characters, at most 72 UTF-8 bytes">
            <Input type="password" autoComplete="new-password" value={password} invalid={!!err}
              aria-invalid={!!err} aria-describedby={err ? 'reset-confirm-error' : undefined}
              onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm password" required>
            <Input type="password" autoComplete="new-password" value={confirmation} invalid={!!err}
              aria-invalid={!!err} aria-describedby={err ? 'reset-confirm-error' : undefined}
              onChange={(e) => setConfirmation(e.target.value)} />
          </Field>
          {err && <p id="reset-confirm-error" role="alert" className="text-[13px] text-tone-danger-400">{err}</p>}
          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">Set new password</Button>
        </form>
      )}
    </AuthFrame>
  )
}

/* =============================================================== onboarding */

export function Onboarding() {
  const nav = useNavigate()
  const { categories } = useCatalogue()
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (g: string) =>
    setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]))

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-3"><Wordmark /><ThemeSelect /></div>
      <div className="py-12">
        <p className="letterboard text-ink-300">Step 1 of 1</p>
        <h1 className="font-marquee mt-2 text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight tracking-[-0.03em] text-fg">
          What should we put in front of you?
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-ink-300">
          Pick anything that interests you. Recommendations use these alongside what you actually
          watch — you can change them whenever you like.
        </p>

        <fieldset className="mt-8">
          <legend className="letterboard mb-3 text-ink-300">Categories</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c.id} on={picked.includes(c.name)} onClick={() => toggle(c.name)}>
                {c.name}
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
          ? 'rounded-sm border border-violet-400 bg-violet-500/18 px-3.5 py-2 text-[14px] font-medium text-tone-violet-100 transition-colors'
          : 'rounded-sm border border-ink-600 bg-ink-850 px-3.5 py-2 text-[14px] text-ink-200 transition-colors hover:border-ink-500 hover:text-fg'
      }
    >
      {children}
    </button>
  )
}
