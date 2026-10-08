import { useState } from 'react'
import { RotateCcw, Wifi } from 'lucide-react'
import { demoBrand, previewCardNumber, validateDemoCard } from '@/lib/demo-card'

/** Local-only demo artwork. Arbitrary numbers and security codes are never displayed. */
export function DemoCardPreview({ number, expiry, name }: { number: string; expiry: string; name: string }) {
  const [flipped, setFlipped] = useState(false)
  const brand = demoBrand(number)
  const validExpiry = !validateDemoCard(number, expiry).expiry
  const holder = name.trim() && !/\d/.test(name) ? name.trim().slice(0, 28) : 'YOUR NAME'
  return <div className="demo-card-preview">
    <div className={`demo-card-scene ${flipped ? 'is-flipped' : ''}`}>
      <div className="demo-card-inner">
        <div className="demo-card-face demo-card-front" data-demo-face="front" aria-hidden={flipped}>
          <div className="demo-card-top"><span className="membership-brand">SKOPIA</span><span className="demo-card-tag">DEMO</span></div>
          <div className="demo-card-hardware"><div className="membership-chip" aria-hidden="true"><i /><i /><i /></div><Wifi aria-hidden="true" className="size-5 rotate-90" /></div>
          <p className="demo-card-number">{previewCardNumber(number, expiry)}</p>
          <div className="demo-card-bottom"><div className="min-w-0"><span className="membership-caption">Cardholder</span><strong className="demo-card-holder">{holder}</strong></div><div><span className="membership-caption">Valid thru</span><strong>{validExpiry && expiry ? expiry : 'MM/YY'}</strong></div><span className={`demo-card-brand ${brand === 'MASTERCARD' ? 'demo-card-mastercard' : ''}`}>{brand === 'VISA' ? 'VISA' : brand === 'MASTERCARD' ? <><i aria-hidden="true" /><i aria-hidden="true" /><span className="sr-only">Mastercard</span></> : 'CARD'}</span></div>
        </div>
        <div className="demo-card-face demo-card-back" data-demo-face="back" aria-hidden={!flipped}>
          <div className="demo-card-stripe" aria-hidden="true" />
          <div className="demo-card-signature"><span>Skopia preview</span><span aria-label="Security code is decorative, not collected">•••</span></div>
          <p className="demo-card-back-note">A preview, not a payment card.<br />Only the supplied test examples work.</p>
          <div className="demo-card-top"><span className="membership-brand">SKOPIA</span><span className="demo-card-tag">NO CHARGE</span></div>
        </div>
      </div>
    </div>
    <button type="button" className="demo-card-flip" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}><RotateCcw aria-hidden="true" className="size-3.5" />{flipped ? 'Show card front' : 'Show card back'}</button>
  </div>
}
