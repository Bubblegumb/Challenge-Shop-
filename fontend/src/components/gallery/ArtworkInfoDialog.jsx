import { useEffect, useRef } from 'react'
import { formatPrice } from '../../utils/formatters'

export default function ArtworkInfoDialog({ artwork, onClose }) {
  const dialog = useRef(null)

  useEffect(() => {
    if (!artwork) return

    const element = dialog.current
    element.showModal()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
    }
  }, [artwork])

  const facts = artwork ? [
    ['Medium', artwork.medium],
    ['Dimensions', artwork.dimensions],
    ['Condition', artwork.condition],
    ['Starting price', `${formatPrice(artwork.priceCents)} AUD`],
    ['Framing', artwork.frame, 'fact-long'],
    ['Collection & postage', 'Collection area to be confirmed; optional postage by quote.', 'fact-long'],
  ] : []

  return (
    <dialog
      ref={dialog}
      className="info-dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {artwork && (
        <div className="dialog-content">
          <div className="dialog-heading">
            <div className="dialog-title-group">
              <p className="eyebrow">Collection notes / {artwork.number}</p>
              <h2 id="dialog-title">{artwork.title}</h2>
            </div>
            <button
              type="button"
              className="close-button"
              onClick={onClose}
              aria-label="Close artwork information"
              autoFocus
            >
              ×
            </button>
          </div>

          <p id="dialog-description" className="dialog-description">{artwork.description}</p>

          <section className="dialog-details" aria-label="Artwork details">
            <dl className="artwork-facts">
              {facts.map(([label, value, className]) => (
                <div key={label} className={className}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="dialog-note">
            Preview only. Artwork details and reference credits are being prepared;
            purchases and bids are not open.
          </p>
        </div>
      )}
    </dialog>
  )
}
