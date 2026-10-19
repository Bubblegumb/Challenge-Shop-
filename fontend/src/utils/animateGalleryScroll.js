export function animateGalleryScroll(element, target, {
  duration = 800,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
} = {}) {
  const previousSnap = element.style.scrollSnapType
  element.style.scrollSnapType = 'none'
  const start = element.scrollLeft
  let frame
  let startedAt = null
  let stopped = false

  function stop() {
    if (stopped) return
    stopped = true
    if (frame !== undefined) cancelFrame(frame)
    element.style.scrollSnapType = previousSnap
  }

  if (start === target || duration <= 0) {
    element.scrollTo({ left: target, behavior: 'instant' })
    stop()
    return stop
  }

  function step(time) {
    if (stopped) return
    startedAt ??= time
    const progress = Math.min((time - startedAt) / duration, 1)
    const eased = progress < 0.5
      ? 4 * progress ** 3
      : 1 - (-2 * progress + 2) ** 3 / 2

    element.scrollTo({ left: start + (target - start) * eased, behavior: 'instant' })
    if (progress < 1) {
      frame = requestFrame(step)
    } else {
      stop()
    }
  }

  frame = requestFrame(step)
  return stop
}
