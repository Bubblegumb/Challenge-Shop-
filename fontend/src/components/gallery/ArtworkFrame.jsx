export default function ArtworkFrame({ artwork, onInfo }) {
  return (
    <div className="artwork-frame">
      <div className="artwork-mat">
        <img
          src={artwork.imageUrl}
          alt={artwork.alt}
          loading={artwork.number === '01' ? 'eager' : 'lazy'}
          decoding="async"
        />
      </div>
      <span className="frame-glass" aria-hidden="true" />
      <button
        className="info-button"
        onClick={() => onInfo(artwork)}
        aria-label={`Information about ${artwork.title}`}
        aria-haspopup="dialog"
        title="About this artwork"
      >
        <span aria-hidden="true">i</span>
      </button>
    </div>
  )
}
