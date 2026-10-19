import GalleryWall from './components/gallery/GalleryWall'
import { artworks } from './data/artworks'
import './styles/App.css'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#gallery">Skip to the artworks</a>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Sujal’s Challenge home">
          <span className="brand-mark" aria-hidden="true">S.</span>
          <span>Sujal’s Challenge</span>
        </a>
        <a className="nav-link" href="#gallery">The collection</a>
      </header>
      <main>
        <section className="intro" aria-label="Exhibition note">
          <div className="exhibition-note">
            <h1>The first collection</h1>
            <span>{artworks.length} works <span aria-hidden="true">·</span> Gallery preview</span>
          </div>
        </section>
        <GalleryWall />
      </main>
      <footer>
        <p>These pieces are copies, imitations, or studies of AI-modified, AI-generated, or inspired artwork. They are not originals by the referenced artists.</p>
      </footer>
    </>
  )
}
