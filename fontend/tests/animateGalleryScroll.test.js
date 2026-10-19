import assert from 'node:assert/strict'
import test from 'node:test'
import { animateGalleryScroll } from '../src/utils/animateGalleryScroll.js'

function animationSetup(start = 0) {
  const pending = new Map()
  let nextId = 0
  const element = {
    scrollLeft: start,
    style: { scrollSnapType: '' },
    scrollTo({ left, behavior }) {
      assert.equal(behavior, 'instant')
      this.scrollLeft = left
    },
  }
  const scheduler = {
    requestFrame(callback) {
      pending.set(++nextId, callback)
      return nextId
    },
    cancelFrame(id) { pending.delete(id) },
  }
  function tick(time) {
    const callbacks = [...pending.values()]
    pending.clear()
    callbacks.forEach(callback => callback(time))
  }
  return { element, scheduler, pending, tick }
}

test('painting transitions ease over 800ms and finish at the exact target', () => {
  const { element, scheduler, pending, tick } = animationSetup()
  animateGalleryScroll(element, 1000, scheduler)
  assert.equal(element.style.scrollSnapType, 'none')

  tick(0)
  tick(200)
  assert.equal(element.scrollLeft, 62.5)
  tick(400)
  assert.equal(element.scrollLeft, 500)
  tick(600)
  assert.equal(element.scrollLeft, 937.5)
  tick(800)
  assert.equal(element.scrollLeft, 1000)
  assert.equal(element.style.scrollSnapType, '')
  assert.equal(pending.size, 0)
})

test('interrupting a transition cancels future frames and restores scroll snapping', () => {
  const { element, scheduler, pending, tick } = animationSetup(1000)
  element.style.scrollSnapType = 'x mandatory'
  const stop = animateGalleryScroll(element, 0, scheduler)
  tick(0)
  tick(400)
  assert.equal(element.scrollLeft, 500)

  stop()
  stop()
  tick(800)
  assert.equal(element.scrollLeft, 500)
  assert.equal(element.style.scrollSnapType, 'x mandatory')
  assert.equal(pending.size, 0)
})

test('zero-duration navigation reaches its target without scheduling animation', () => {
  const { element, scheduler, pending } = animationSetup()
  animateGalleryScroll(element, 1000, { ...scheduler, duration: 0 })
  assert.equal(element.scrollLeft, 1000)
  assert.equal(element.style.scrollSnapType, '')
  assert.equal(pending.size, 0)
})
