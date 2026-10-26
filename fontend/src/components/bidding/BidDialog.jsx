import { useEffect, useRef, useState } from 'react'
import { getAuction, placeBid, requestBidCode, verifyBidCode } from '../../services/auction'
import { AUCTION_DEADLINE_LABEL, BID_CAP_CENTS, COLLECTION_NOTE, biddingClosed, formatBid, parseBidCents } from '../../utils/bidding'

export default function BidDialog({ artwork, lot, closed = false, onClose, onAccepted }) {
  const dialog = useRef(null)
  const attempt = useRef(null)
  const busy = useRef(false)
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState('details')
  const [verified, setVerified] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [uncertain, setUncertain] = useState(false)
  const locked = Boolean(lot?.locked || lot?.highest_amount_cents >= BID_CAP_CENTS)
  const unavailable = closed || locked
  const minimum = lot?.highest_amount_cents == null ? 1000 : lot.highest_amount_cents + 1
  const normalizedEmail = email.trim().toLowerCase()
  const hasVerifiedEmail = verified?.email === normalizedEmail
  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000))

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  useEffect(() => {
    if (!resendAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [resendAt])

  async function run(operation, action) {
    if (busy.current) return
    busy.current = true
    setPending(action)
    setError('')
    try {
      await operation()
    } catch (failure) {
      setError(failure.message)
      if (failure.code === 'EMAIL_NOT_VERIFIED') {
        setVerified(null)
        setPhase('details')
        setNotice('Please request a new code to verify your email again.')
      }
    } finally {
      busy.current = false
      setPending('')
    }
  }

  function currentBid() {
    const cents = parseBidCents(amount)
    if (cents == null || cents < minimum) {
      throw new Error(`Enter a bid between ${formatBid(minimum)} and $75.00 AUD.`)
    }
    return {
      p_artwork_id: artwork.id,
      p_amount_cents: cents,
      p_name: name.trim(),
      p_email: normalizedEmail,
      p_website: website,
    }
  }

  async function checkAvailability(bid) {
    const auction = await getAuction()
    onAccepted(null, auction)
    const currentLot = auction.lots.find(item => item.id === artwork.id)
    if (auction.closed || biddingClosed(auction.closes_at, Date.parse(auction.server_time))) {
      throw new Error('Bidding has closed. No further bids can be accepted.')
    }
    if (currentLot?.locked || currentLot?.highest_amount_cents >= BID_CAP_CENTS) {
      throw new Error('This artwork has been secured at $75 AUD. No further bids can be placed.')
    }
    if (!auction.accepting_bids || !currentLot) throw new Error('Bidding is not available. Please try again shortly.')
    if (bid.p_amount_cents <= (currentLot.highest_amount_cents ?? 0)) {
      setPhase('details')
      throw new Error('Someone has placed a higher bid. Update your amount before continuing.')
    }
  }

  async function sendCode() {
    const bid = currentBid()
    await checkAvailability(bid)
    await requestBidCode(bid.p_email)
    setCode('')
    setPhase('verify')
    const sentAt = Date.now()
    setNow(sentAt)
    setResendAt(sentAt + 60000)
    setNotice(`A verification code has been sent to ${bid.p_email}. Sending a code does not reserve the artwork or place a bid.`)
  }

  async function submitBid(bid, accessToken, replay = false) {
    if (!replay) await checkAvailability(bid)
    const fingerprint = JSON.stringify(bid)
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, id: crypto.randomUUID(), bid }
    }
    try {
      await placeBid({ ...bid, p_request_id: attempt.current.id }, accessToken)
      const message = bid.p_amount_cents === BID_CAP_CENTS
        ? `Your $75.00 AUD bid for ${artwork.title} was accepted. This artwork is secured for you and no further bids can be placed.`
        : `Your ${formatBid(bid.p_amount_cents)} AUD bid for ${artwork.title} was accepted. You may still be outbid before closing.`
      onAccepted(message)
    } catch (failure) {
      const unknown = Boolean(failure.uncertain || failure.name === 'AbortError' || failure.name === 'TimeoutError')
      setUncertain(unknown)
      if (unknown) {
        setNotice('Your bid may have been received. Check the result below; this safely retries the same bid.')
      } else {
        setPhase('details')
      }
      getAuction().then(auction => onAccepted(null, auction)).catch(() => {})
      throw failure
    }
  }

  function submit(event) {
    event.preventDefault()
    run(async () => {
      if (uncertain && attempt.current && hasVerifiedEmail) {
        await submitBid(attempt.current.bid, verified.token, true)
        return
      }
      if (unavailable) throw new Error(locked ? 'This artwork has already been secured at $75 AUD.' : 'Bidding has closed.')
      if (phase === 'details') {
        if (hasVerifiedEmail) await submitBid(currentBid(), verified.token)
        else await sendCode()
        return
      }
      const bid = currentBid()
      const token = hasVerifiedEmail ? verified.token : await verifyBidCode(bid.p_email, code)
      setVerified({ email: bid.p_email, token })
      setPhase('details')
      setNotice('Email verified. Checking your bid…')
      await submitBid(bid, token)
    }, phase === 'verify' ? 'Verifying and placing bid…' : hasVerifiedEmail || uncertain ? 'Checking bid…' : 'Sending code…')
  }

  function changeDetails() {
    setPhase('details')
    setError('')
    setNotice(hasVerifiedEmail ? 'Email verified. You can update your bid amount.' : 'Update your details, then request a new verification code.')
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
          <button type="button" className="close-button" onClick={onClose} disabled={Boolean(pending)} aria-label="Close bidding">×</button>
        </div>
        <p className="bid-minimum">{locked ? 'This artwork is secured at $75.00 AUD.' : `Minimum bid: ${formatBid(minimum)} AUD. Maximum: $75.00 AUD.`} Closes {AUCTION_DEADLINE_LABEL}.</p>
        <p className="bid-terms"><strong>Unframed artwork. No frame is included.</strong></p>
        <p className="bid-collection-note">{COLLECTION_NOTE}</p>
        <ol className="bid-steps" aria-label="Bid progress">
          <li aria-current={phase === 'details' ? 'step' : undefined}>Your bid</li>
          <li aria-current={phase === 'verify' ? 'step' : undefined}>Verify email</li>
        </ol>
        <form onSubmit={submit} className="auction-form">
          <label>Bid amount (AUD)<input name="amount" inputMode="decimal" required autoFocus
            value={amount} onChange={event => setAmount(event.target.value)} placeholder={formatBid(Math.min(minimum, BID_CAP_CENTS))}
            disabled={Boolean(pending) || phase === 'verify' || uncertain || unavailable} /></label>
          <label>Name<input name="name" autoComplete="name" required maxLength={100} value={name}
            onChange={event => setName(event.target.value)} disabled={Boolean(pending) || phase === 'verify' || uncertain || unavailable} /></label>
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} value={email}
            onChange={event => { setEmail(event.target.value); setVerified(null); setCode('') }}
            disabled={Boolean(pending) || phase === 'verify' || uncertain || unavailable} /></label>
          <label className="bid-trap" aria-hidden="true">Leave empty<input name="website" tabIndex={-1} autoComplete="off"
            value={website} onChange={event => setWebsite(event.target.value)} /></label>
          {phase === 'verify' && <div className="bid-verification">
            <label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}"
              required minLength={6} maxLength={10} value={code} onChange={event => setCode(event.target.value)}
              disabled={Boolean(pending) || uncertain || unavailable} autoFocus /></label>
            <div className="bid-actions">
              <button type="button" className="bid-secondary" disabled={Boolean(pending) || uncertain || unavailable || resendSeconds > 0}
                onClick={() => run(sendCode, 'Sending code…')}>{resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}</button>
              <button type="button" className="bid-secondary" onClick={changeDetails} disabled={Boolean(pending) || uncertain}>Change details</button>
            </div>
          </div>}
          <p className="bid-note">The first verified $75 bid secures this artwork. Until your bid is accepted, another bidder can secure it.</p>
          <p className="bid-note">Your name and email are private to the organiser. If you win, you agree to donate your exact winning bid using the link emailed to you.</p>
          <p className="bid-note" role="status" aria-live="polite">{unavailable && !uncertain ? locked ? 'This artwork has been secured. No further bids can be placed.' : 'Bidding has closed.' : notice}</p>
          {error && <p role="alert" className="auction-error">{error}</p>}
          <button type="submit" className="auction-button" disabled={Boolean(pending) || (unavailable && !uncertain)}>
            {pending || (uncertain ? 'Check bid result' : locked ? 'Artwork secured' : closed ? 'Bidding closed' :
              phase === 'verify' ? `Verify and place bid · ${formatBid(parseBidCents(amount) ?? 0)}` : hasVerifiedEmail ? 'Place verified bid' : 'Send verification code')}
          </button>
        </form>
      </div>
    </dialog>
  )
}
