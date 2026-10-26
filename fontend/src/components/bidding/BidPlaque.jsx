import { formatPrice } from '../../utils/formatters'
import { formatBid } from '../../utils/bidding'

export default function BidPlaque({ artwork, lot, canBid = false, closed = false, onBid }) {
  return (
    <div className="price-plaque">
      <span className="eyebrow">{lot?.highest_amount_cents != null ? 'Highest bid' : 'Starting price'}</span>
      {artwork.priceCents == null
        ? <p className="price-pending">To be confirmed</p>
        : <p>{lot?.highest_amount_cents != null ? formatBid(lot.highest_amount_cents) : formatPrice(artwork.priceCents)} <small>AUD</small></p>}
      <span className="bid-note">Unframed artwork</span>
      {onBid && <button type="button" className="auction-button" disabled={!canBid} onClick={() => onBid(artwork)}>
        {closed ? 'Bidding closed' : canBid ? 'Place bid' : 'Bidding unavailable'}
      </button>}
    </div>
  )
}
