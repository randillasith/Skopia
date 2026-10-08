import { useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const scenes = [
  { image: 'mountain', title: 'Find your next perspective', alt: 'Violet dusk falling across a mountain range' },
  { image: 'city', title: 'Let a different world pull you in', alt: 'Rain reflecting the lights of a city at night' },
  { image: 'forest', title: 'Make room for a little wonder', alt: 'Soft sunlight filtering through a forest canopy' },
]

/** Editorial imagery, independent of the live catalogue. Never advertises a playable title. */
export function CinematicDeck() {
  const [active, setActive] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const move = (step: number) => setActive((current) => (current + step + scenes.length) % scenes.length)
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
          const depth = (index - active + scenes.length) % scenes.length
          return <div key={scene.image} className="cinema-screen" data-depth={depth}
            style={{ '--depth': depth } as CSSProperties} aria-hidden={depth !== 0}>
            <img src={`/images/screening-${scene.image}.webp`} alt={scene.alt}
              width="1440" height="810" fetchPriority={index === 0 ? 'high' : 'auto'} draggable={false} />
          </div>
        })}
      </div>
      <div className="cinema-caption">
        <div>
          <p className="font-medium text-fg" aria-live="polite" aria-atomic="true">{scenes[active].title}</p>
          <div className="cinema-progress" aria-hidden="true">{scenes.map((scene, index) => <span key={scene.image} className={index === active ? 'is-active' : ''} />)}</div>
        </div>
        <div className="flex gap-2">
          <button className="cinema-arrow" aria-label="Previous scene" onClick={() => move(-1)}><ArrowLeft size={18} /></button>
          <button className="cinema-arrow" aria-label="Next scene" onClick={() => move(1)}><ArrowRight size={18} /></button>
        </div>
      </div>
    </div>
  )
}
