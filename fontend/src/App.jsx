import { useEffect, useState } from 'react'
import GalleryWall from './components/gallery/GalleryWall'
import { collections } from './data/artworks'
import useAuction from './hooks/useAuction'
import BidDialog from './components/bidding/BidDialog'
import OwnerPage from './pages/OwnerPage'
import { auctionConfigured, getAuction } from './services/auction'
import { AUCTION_CLOSES_AT, biddingClosed } from './utils/bidding'
import './styles/App.css'

export default function App() {
  const [ownerPage, setOwnerPage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#owner')
  useEffect(() => {
    const update = () => setOwnerPage(window.location.hash === '#owner')
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return ownerPage ? <OwnerPage /> : <AuctionGallery />
}

function AuctionGallery() {
  const { auction, error, loading, receivedAt, updateAuction } = useAuction()
  const [bidArtwork, setBidArtwork] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const serverNow = auction ? Date.parse(auction.server_time) + Math.max(0, now - receivedAt) : now
  const closed = Boolean(auction?.closed) || biddingClosed(auction?.closes_at ?? AUCTION_CLOSES_AT, serverNow)
  const canBid = Boolean(auction?.accepting_bids && !closed && !error && !loading)
  function accepted(message, freshAuction) {
    if (message) {
      setAnnouncement(message)
      setBidArtwork(null)
      getAuction().then(updateAuction).catch(() => {})
    }
    if (freshAuction) updateAuction(freshAuction)
  }
  const [collectionIndex, setCollectionIndex] = useState(0)
  const collection = collections[collectionIndex]
  const nextCollectionIndex = (collectionIndex + 1) % collections.length
  const nextCollection = collections[nextCollectionIndex]
  const workCount = collection.artworks.length === collection.plannedWorkCount
    ? `${collection.artworks.length} works`
    : `${collection.artworks.length} of ${collection.plannedWorkCount} works`
  const auctionStatus = error || (closed ? 'Bidding is closed.' : loading ? 'Checking current bids…' :
    !auctionConfigured || !auction?.accepting_bids ? 'Bidding is being prepared. Please check back soon.' : '')

  return (
    <>
      <a className="skip-link" href="#gallery">Skip to the artworks</a>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Sujal’s Challenge home">
          <span className="brand-mark" aria-hidden="true">S.</span>
          <span>Sujal’s Challenge</span>
        </a>
        <a className="nav-link" href="#gallery">The collections</a>
      </header>
      <main className="auction-gallery">
        <section className="intro" aria-label="Exhibition note">
          <div className="exhibition-note">
            <h1>
              <button
                type="button"
                className="collection-switch"
                onClick={() => setCollectionIndex(nextCollectionIndex)}
                aria-label={`${collection.title}. Switch to ${nextCollection.title.toLowerCase()}.`}
                aria-controls="gallery"
                title={`View ${nextCollection.title.toLowerCase()}`}
              >
                {collection.title}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" />
                </svg>
              </button>
            </h1>
            <div className="exhibition-meta">
              <span aria-live="polite" aria-atomic="true">{workCount} <span aria-hidden="true">·</span> Gallery preview</span>
              {auctionStatus && <p className="gallery-status" role={error ? 'alert' : 'status'}>{auctionStatus}</p>}
              <p className="gallery-status" role="status" aria-live="polite">{announcement}</p>
            </div>
          </div>
        </section>
        <GalleryWall key={collection.id} collection={collection} auction={auction} canBid={canBid} closed={closed} onBid={setBidArtwork} />
        {bidArtwork && <BidDialog artwork={bidArtwork} lot={auction?.lots.find(lot => lot.id === bidArtwork.id)}
          closed={closed} onClose={() => setBidArtwork(null)} onAccepted={accepted} />}
      </main>
      <footer>
        <p>All artwork is unframed. Collection at the State Library during a one-hour window; booking details will be emailed to winners.</p>
        <p>These pieces are copies, imitations, or studies of AI-modified, AI-generated, or inspired artwork. They are not originals by the referenced artists.</p>
      </footer>
    </>
  )
}
