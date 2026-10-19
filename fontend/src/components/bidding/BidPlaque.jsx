import { formatPrice } from '../../utils/formatters'

export default function BidPlaque({ artwork }) {
  return (
    <div className="price-plaque">
      <span className="eyebrow">Starting price</span>
      {artwork.priceCents == null
        ? <p className="price-pending">To be confirmed</p>
        : <p>{formatPrice(artwork.priceCents)} <small>AUD</small></p>}
    </div>
  )
}
