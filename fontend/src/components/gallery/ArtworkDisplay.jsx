import ArtworkFrame from './ArtworkFrame'
import BidPlaque from '../bidding/BidPlaque'

export default function ArtworkDisplay({ artwork, onInfo }) {
  return (
    <article className="artwork-display" aria-labelledby={`title-${artwork.id}`}>
      <div className="hanging-work">
        <ArtworkFrame artwork={artwork} onInfo={onInfo} />
      </div>
      <div className="artwork-sidebar">
        <div className="artwork-summary">
          <p className="work-number">The first collection / {artwork.number}</p>
          <h2 id={`title-${artwork.id}`}>{artwork.title}</h2>
        </div>
        <BidPlaque artwork={artwork} />
      </div>
    </article>
  )
}
