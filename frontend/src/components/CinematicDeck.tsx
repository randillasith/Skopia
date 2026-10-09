import { useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Video } from '@/lib/data'
import { PosterPlate } from './world'

/** Published catalogue artwork, linked to the actual watch page. */
export function CinematicDeck({ videos }: { videos: Video[] }) {
  const scenes = videos.slice(0, 3)
  const [active, setActive] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const selected = scenes.length ? active % scenes.length : 0
  const move = (step: number) => setActive((current) => (current % scenes.length + step + scenes.length) % scenes.length)
  const reset = () => {
    stage.current?.style.setProperty('--look-x', '0deg')
    stage.current?.style.setProperty('--look-y', '0deg')
  }
  return (
    <div className="cinema-deck" role="region" aria-label="Skopia cinematic showcase">
      <div className="cinema-stage" ref={stage} onPointerMove={(event) => {
        if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const box = event.currentTarget.getBoundingClientRect()
        event.currentTarget.style.setProperty('--look-x', `${((event.clientX - box.left) / box.width - .5) * 4}deg`)
        event.currentTarget.style.setProperty('--look-y', `${((event.clientY - box.top) / box.height - .5) * -3}deg`)
      }} onPointerLeave={reset}>
        {scenes.map((scene, index) => {
          const depth = (index - selected + scenes.length) % scenes.length
          return <Link to={`/watch/${scene.id}`} tabIndex={depth === 0 ? 0 : -1} aria-label={`Watch ${scene.title}`} key={scene.id} className="cinema-screen" data-depth={depth}
            style={{ '--depth': depth } as CSSProperties} aria-hidden={depth !== 0}>
            <PosterPlate title={scene.title} seed={scene.seed} thumbnailUrl={scene.thumbnailUrl} lettering={false} />
          </Link>
        })}
      </div>
      {!scenes.length && <p className="text-fg-muted text-center">No published videos yet.</p>}
      <div className="cinema-caption">
        <div>
          <p className="font-medium text-fg" aria-live="polite" aria-atomic="true">{scenes[selected]?.title ?? 'Published stories will appear here'}</p>
          <div className="cinema-progress" aria-hidden="true">{scenes.map((scene, index) => <span key={scene.id} className={index === selected ? 'is-active' : ''} />)}</div>
        </div>
        <div className="flex gap-2">
          <button disabled={scenes.length < 2} className="cinema-arrow" aria-label="Previous scene" onClick={() => move(-1)}><ArrowLeft size={18} /></button>
          <button disabled={scenes.length < 2} className="cinema-arrow" aria-label="Next scene" onClick={() => move(1)}><ArrowRight size={18} /></button>
        </div>
      </div>
    </div>
  )
}
