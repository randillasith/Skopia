import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { ThemeSelect } from '@/components/ThemeSelect'
import { Wordmark } from '@/components/Shell'
import { CinematicDeck } from '@/components/CinematicDeck'
import { Loading } from '@/components/Loading'
import { Button } from '@/components/primitives'
import { useCatalogue } from '@/lib/useCatalogue'
import { Tile } from './viewer'

export function Lobby() {
  const { videos, categories, loading, error, refresh } = useCatalogue()
  const [category, setCategory] = useState('All')
  const available = videos.filter((v) => v.billing === 'NOW SHOWING' || v.billing === 'HELD OVER')
  const choices = categories.filter((c) => available.some((v) => v.category === c.name)).slice(0, 4)
  const selection = category === 'All' || !choices.some((c) => c.name === category) ? 'All' : category
  const programme = available.filter((v) => selection === 'All' || v.category === selection).slice(0, 5)
  return (
    <div className="screening-room min-h-dvh bg-canvas">
      <a href="#programme" className="screening-skip">Skip to the programme</a>
      <header className="screening-nav screening-width">
        <Wordmark />
        <nav className="screening-links" aria-label="Main navigation">
          <a href="#programme">Explore</a><a href="#experience">The experience</a><Link to="/plans">Passes</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 sm:gap-5"><ThemeSelect /><Link to="/login" className="screening-signin">Sign in <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
      </header>
      <main>
        <section className="screening-hero screening-width" aria-labelledby="welcome-title">
          <div className="screening-intro">
            <h1 id="welcome-title">Watch<br />beyond<br />limits.</h1>
            <p>A new perspective is one play away. Explore films, discover creators, and make room for your next favourite.</p>
            <div className="screening-actions">
              <Link to="/browse" className="screening-primary">Explore the programme <ArrowRight size={18} /></Link>
              <Link to="/signup" className="screening-secondary">Create an account</Link>
            </div>
          </div>
          <CinematicDeck />
        </section>
        <section id="programme" className="screening-programme screening-width" aria-labelledby="programme-title">
          <div className="screening-section-head">
            <h2 id="programme-title">Something worth staying for.</h2>
            {choices.length > 0 && <div className="screening-filters" role="group" aria-label="Filter programme by category">
              {['All', ...choices.map((c) => c.name)].map((name) => <button key={name} aria-pressed={selection === name} onClick={() => setCategory(name)}>{name}</button>)}
            </div>}
          </div>
          {loading ? <Loading what="Loading the programme" /> : error ? <div className="screening-empty" role="status"><p>The programme couldn’t load.</p><p className="text-fg-muted">Please try again in a moment.</p><Button onClick={refresh}>Try again</Button></div>
            : programme.length ? <div className="screening-films">{programme.map((v) => <Tile key={v.id} v={v} size="sm" />)}</div>
              : <div className="screening-empty"><p>The next story is on its way.</p><p className="text-fg-muted">Published films will appear here when they’re ready to watch.</p><Link to="/browse" className="screening-text-link">Open the catalogue <ArrowRight size={16} /></Link></div>}
          {programme.length > 0 && <Link to="/browse" className="screening-text-link mt-8">See the whole programme <ArrowRight size={16} /></Link>}
        </section>
        <section id="experience" className="screening-experience screening-width" aria-labelledby="experience-title">
          <div className="screening-window theme-media">
            <img src="/images/screening-forest.webp" alt="Sunlight reaching through a misty forest" width="1440" height="810" loading="lazy" />
            <Link to="/browse" className="screening-play" aria-label="Browse the programme"><ArrowUpRight size={26} aria-hidden="true" /><span>Browse</span></Link>
          </div>
          <div className="screening-experience-copy">
            <h2 id="experience-title">Your time.<br />Your kind of story.</h2>
            <p>Browse freely. Find a creator you connect with. Save something for later, or press play and see where it takes you.</p>
            <Link to="/signup" className="screening-text-link">Find your place <ArrowUpRight size={18} /></Link>
          </div>
        </section>
        <section className="screening-pass screening-width" aria-labelledby="pass-title">
          <div><h2 id="pass-title">Stay for more.</h2><p>A pass opens the premium programme and removes advertising.</p></div>
          <Link to="/plans" className="screening-primary">Explore passes <ArrowRight size={18} /></Link>
        </section>
      </main>
      <footer className="screening-footer screening-width"><Wordmark /><span>Watch beyond limits.</span><div className="ml-auto flex gap-6"><Link to="/browse">Explore</Link><Link to="/login">Sign in</Link></div></footer>
    </div>
  )
}
