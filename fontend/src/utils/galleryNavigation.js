export function clampSlideIndex(index, slideCount) {
  return Math.max(0, Math.min(slideCount - 1, index))
}

export function createGalleryWheelHandler({ slideCount, getActiveIndex, onNavigate }) {
  const gesturePause = 180
  const navigationDelay = 800
  const threshold = 32
  let lastEventTime = -Infinity
  let lastNavigationTime = -Infinity
  let direction = 0
  let distance = 0
  let navigated = false

  return event => {
    // Leave trackpad horizontal scrolling and browser pinch-to-zoom native.
    if (event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return

    const nextDirection = Math.sign(event.deltaY)
    if (event.timeStamp - lastEventTime > gesturePause || nextDirection !== direction) {
      distance = 0
      navigated = false
    }
    direction = nextDirection
    lastEventTime = event.timeStamp

    const active = getActiveIndex()
    const target = clampSlideIndex(active + direction, slideCount)
    if (target === active && !navigated) return

    event.preventDefault()
    if (navigated || event.timeStamp - lastNavigationTime < navigationDelay) return

    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? threshold : 1
    distance += Math.abs(event.deltaY) * unit
    if (distance < threshold) return

    // Ignore the rest of this gesture's momentum so it cannot skip paintings.
    navigated = true
    lastNavigationTime = event.timeStamp
    onNavigate(target)
  }
}
