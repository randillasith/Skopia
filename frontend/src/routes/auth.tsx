import { ThemeSelect } from '@/components/ThemeSelect'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Input, Checkbox } from '@/components/primitives'
import { PosterPlate, Letterboard } from '@/components/world'
import { Wordmark, useSession } from '@/components/Shell'
import { useCatalogue } from '@/lib/useCatalogue'
import { homeFor } from '@/lib/session'
import { accounts, ApiError } from '@/lib/accounts'

export { Lobby } from './Lobby'

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

export function ResetPassword() {
  return <AuthFrame title="Password recovery" lede="Email password recovery is not available yet."
    foot={<Link to="/login" className="text-tone-violet-300 underline">Back to sign in</Link>}>
    <p role="status" className="text-sm leading-relaxed text-fg-muted">No reset email has been sent. Please contact your platform administrator for account assistance.</p>
  </AuthFrame>
}

/* =============================================================== onboarding */

export function Onboarding() {
  const { categories, loading, error, refresh } = useCatalogue()
  return <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 sm:px-6">
    <div className="flex items-center justify-between gap-3"><Wordmark /><ThemeSelect /></div>
    <div className="py-12">
      <h1 className="font-marquee text-4xl font-bold text-fg">Find your first story.</h1>
      <p className="mt-4 text-fg-muted">Explore a category from the programme, or browse everything.</p>
      {loading && <p role="status" className="mt-8">Loading categories…</p>}
      {error && <div className="mt-8"><p role="alert">Categories could not load.</p><Button onClick={refresh}>Try again</Button></div>}
      <div className="mt-8 flex flex-wrap gap-3">{categories.map(c => <Link key={c.id} to={`/category/${encodeURIComponent(c.name)}`} className="screening-secondary">{c.name}</Link>)}</div>
      <Link to="/browse" className="screening-primary mt-10">Explore the programme</Link>
    </div>
  </div>
}
