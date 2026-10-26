import { formatPrice } from '../../utils/formatters'
import { BID_CAP_CENTS, formatBid } from '../../utils/bidding'

export default function BidPlaque({ artwork, lot, canBid = false, closed = false, onBid }) {
  const locked = Boolean(lot?.locked || lot?.highest_amount_cents >= BID_CAP_CENTS)
  return (
    <div className="price-plaque">
      <span className="eyebrow">{locked ? 'Secured at $75' : lot?.highest_amount_cents != null ? 'Highest bid' : 'Starting price'}</span>
      {artwork.priceCents == null
        ? <p className="price-pending">To be confirmed</p>
        : <p>{lot?.highest_amount_cents != null ? formatBid(lot.highest_amount_cents) : formatPrice(artwork.priceCents)} <small>AUD</small></p>}
      <span className="bid-note">Unframed artwork</span>
      {!locked && <span className="bid-note">First verified $75 bid secures this work.</span>}
      {onBid && <button type="button" className="auction-button" disabled={!canBid || locked} onClick={() => onBid(artwork)}>
        {locked ? 'Artwork secured' : closed ? 'Bidding closed' : canBid ? 'Place bid' : 'Bidding unavailable'}
      </button>}
    </div>
  )
}
