import { useCallback, useEffect, useRef, useState } from 'react'
import { artworks } from '../../data/artworks'
import { formatArtworkNumber } from '../../utils/formatters'
import { clampSlideIndex, createGalleryWheelHandler } from '../../utils/galleryNavigation'
import { animateGalleryScroll } from '../../utils/animateGalleryScroll'
import ArtworkDisplay from './ArtworkDisplay'
import ArtworkInfoDialog from './ArtworkInfoDialog'

export default function GalleryWall() {
  const wall = useRef(null)
  const activeSlide = useRef(0)
  const scrollAnimation = useRef(null)
  const [selected, setSelected] = useState(null)
  const [active, setActive] = useState(0)

  const stopAnimation = useCallback(() => {
    scrollAnimation.current?.()
    scrollAnimation.current = null
  }, [])

  // Keep the current slide aligned when rotating a phone or resizing a laptop.
  useEffect(() => {
    const element = wall.current
    const observer = new ResizeObserver(() => {
      stopAnimation()
      element.scrollTo({ left: activeSlide.current * element.clientWidth, behavior: 'instant' })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      stopAnimation()
    }
  }, [stopAnimation])

  const goTo = useCallback(index => {
    const target = clampSlideIndex(index, artworks.length)
    const element = wall.current
    const left = target * element.clientWidth
    stopAnimation()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.scrollTo({ left, behavior: 'instant' })
      return
    }

    scrollAnimation.current = animateGalleryScroll(element, left)
  }, [stopAnimation])

  useEffect(() => {
    const element = wall.current
    const navigateWithWheel = createGalleryWheelHandler({
      slideCount: artworks.length,
      getActiveIndex: () => activeSlide.current,
      onNavigate: goTo,
    })

    function handleWheel(event) {
      const horizontal = event.deltaX !== 0 && Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      if (event.ctrlKey || horizontal) stopAnimation()
      navigateWithWheel(event)
    }

    // A non-passive listener can consume vertical scrolling inside the gallery.
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [goTo, stopAnimation])

  function handleKeyDown(event) {
    if (event.target !== event.currentTarget) return
    const destinations = {
      ArrowLeft: active - 1,
      ArrowRight: active + 1,
      Home: 0,
      End: artworks.length - 1,
    }
    if (!(event.key in destinations)) return
    event.preventDefault()
    goTo(destinations[event.key])
  }

  function updatePosition() {
    const element = wall.current
    if (!element.clientWidth) return
    const index = clampSlideIndex(
      Math.round(element.scrollLeft / element.clientWidth),
      artworks.length,
    )
    activeSlide.current = index
    setActive(index)
  }

  return (
    <section id="gallery" className="gallery" aria-label="Artwork gallery">
      <div
        ref={wall}
        className="gallery-wall"
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="Artwork collection. Scroll, swipe, or use left and right arrow keys to browse."
        onKeyDown={handleKeyDown}
        onScroll={updatePosition}
        onPointerDown={stopAnimation}
      >
        {artworks.map((artwork, index) => (
          <div className="artwork-slide" key={artwork.id} inert={index !== active} aria-hidden={index !== active}>
            <ArtworkDisplay artwork={artwork} onInfo={setSelected} />
          </div>
        ))}
      </div>
      <div className="gallery-controls">
        <p className="browse-hint">Scroll, swipe or use the arrows to explore</p>
        <div className="paging">
          <span aria-live="polite" aria-atomic="true" aria-label={`Artwork ${active + 1} of ${artworks.length}`}>
            {formatArtworkNumber(active + 1)} <span className="muted">/ {formatArtworkNumber(artworks.length)}</span>
          </span>
          <button onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous artwork">←</button>
          <button onClick={() => goTo(active + 1)} disabled={active === artworks.length - 1} aria-label="Next artwork">→</button>
        </div>
      </div>
      <ArtworkInfoDialog artwork={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
