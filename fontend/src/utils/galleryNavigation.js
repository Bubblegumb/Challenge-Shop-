export function clampSlideIndex(index, slideCount) {
  return Math.max(0, Math.min(slideCount - 1, index))
}
