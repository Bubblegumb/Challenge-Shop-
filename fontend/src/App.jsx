import { useState } from 'react'
import GalleryWall from './components/gallery/GalleryWall'
import { collections } from './data/artworks'
import './styles/App.css'

export default function App() {
  const [collectionIndex, setCollectionIndex] = useState(0)
  const collection = collections[collectionIndex]
  const nextCollectionIndex = (collectionIndex + 1) % collections.length
  const nextCollection = collections[nextCollectionIndex]
  const workCount = collection.artworks.length === collection.plannedWorkCount
    ? `${collection.artworks.length} works`
    : `${collection.artworks.length} of ${collection.plannedWorkCount} works`

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
      <main>
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
            <span aria-live="polite" aria-atomic="true">{workCount} <span aria-hidden="true">·</span> Gallery preview</span>
          </div>
        </section>
        <GalleryWall key={collection.id} collection={collection} />
      </main>
      <footer>
        <p>These pieces are copies, imitations, or studies of AI-modified, AI-generated, or inspired artwork. They are not originals by the referenced artists.</p>
      </footer>
    </>
  )
}
