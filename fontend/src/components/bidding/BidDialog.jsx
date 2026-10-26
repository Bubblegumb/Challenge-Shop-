import { useEffect, useRef, useState } from 'react'
import { getAuction, placeBid } from '../../services/auction'
import { AUCTION_DEADLINE_LABEL, COLLECTION_NOTE, formatBid, parseBidCents } from '../../utils/bidding'

export default function BidDialog({ artwork, lot, closed = false, onClose, onAccepted }) {
  const dialog = useRef(null)
  const attempt = useRef(null)
  const busy = useRef(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const minimum = lot?.highest_amount_cents == null ? 1000 : lot.highest_amount_cents + 1

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (busy.current) return
    if (closed) { setError('Bidding has closed.'); return }
    const values = new FormData(event.currentTarget)
    const cents = parseBidCents(amount)
    if (cents == null || cents < minimum) {
      setError(`Enter a bid of at least ${formatBid(minimum)} AUD.`)
      return
    }
    const bid = {
      p_artwork_id: artwork.id,
      p_amount_cents: cents,
      p_name: String(values.get('name')).trim(),
      p_email: String(values.get('email')).trim(),
      p_website: String(values.get('website') ?? ''),
    }
    const fingerprint = JSON.stringify(bid)
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, id: crypto.randomUUID() }
    }
    busy.current = true
    setPending(true)
    setError('')
    try {
      await placeBid({ ...bid, p_request_id: attempt.current.id })
      onAccepted(`Your ${formatBid(cents)} AUD bid for ${artwork.title} was accepted. You may still be outbid before closing.`)
    } catch (failure) {
      setError(failure.message)
      // Refresh prices after a competing bid without discarding the form.
      getAuction().then(auction => onAccepted(null, auction)).catch(() => {})
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <dialog ref={dialog} className="info-dialog bid-dialog" aria-labelledby="bid-title"
      onCancel={event => { event.preventDefault(); if (!busy.current) onClose() }}
      onClick={event => { if (event.target === event.currentTarget && !busy.current) onClose() }}>
      <div className="dialog-content">
        <div className="dialog-heading">
          <div className="dialog-title-group">
            <p className="eyebrow">{artwork.collectionTitle} / {artwork.number}</p>
            <h2 id="bid-title">Bid for {artwork.title}</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} disabled={pending} aria-label="Close bidding">×</button>
        </div>
        <p className="bid-minimum">Minimum bid: {formatBid(minimum)} AUD. Closes {AUCTION_DEADLINE_LABEL}.</p>
        <p className="bid-terms"><strong>Unframed artwork. No frame is included.</strong></p>
        <p className="bid-collection-note">{COLLECTION_NOTE}</p>
        <form onSubmit={submit} className="auction-form">
          <label>Bid amount (AUD)<input name="amount" inputMode="decimal" required autoFocus
            value={amount} onChange={event => setAmount(event.target.value)} placeholder={formatBid(minimum)} disabled={pending} /></label>
          <label>Name<input name="name" autoComplete="name" required maxLength={100} disabled={pending} /></label>
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} /></label>
          <label className="bid-trap" aria-hidden="true">Leave empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <p className="bid-note">Your name and email are private to the organiser. If you win, you agree to donate your exact winning bid using the link emailed to you.</p>
          {error && <p role="alert" className="auction-error">{error}</p>}
          <button type="submit" className="auction-button" disabled={pending || closed}>{closed ? 'Bidding closed' : pending ? 'Submitting…' : `Place bid${amount && parseBidCents(amount) ? ` · ${formatBid(parseBidCents(amount))}` : ''}`}</button>
        </form>
      </div>
    </dialog>
  )
}
