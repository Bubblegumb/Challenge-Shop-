import assert from 'node:assert/strict'
import test from 'node:test'
import { clampSlideIndex, createGalleryWheelHandler } from '../src/utils/galleryNavigation.js'

test('navigation clamps requests to the first and last available slides', () => {
  for (const [requested, expected] of [[-5, 0], [0, 0], [4, 4], [9, 9], [10, 9], [100, 9]]) {
    assert.equal(clampSlideIndex(requested, 10), expected)
  }
})

test('a one-artwork collection always navigates to its only slide', () => {
  assert.equal(clampSlideIndex(-1, 1), 0)
  assert.equal(clampSlideIndex(0, 1), 0)
  assert.equal(clampSlideIndex(1, 1), 0)
})

test('clamping preserves an in-range position without rounding it', () => {
  assert.equal(clampSlideIndex(2.5, 10), 2.5)
})

function wheelEvent(overrides = {}) {
  return {
    deltaX: 0,
    deltaY: 100,
    deltaMode: 0,
    timeStamp: 0,
    ctrlKey: false,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true },
    ...overrides,
  }
}

function wheelGallery(initial = 0) {
  let active = initial
  const destinations = []
  const handleWheel = createGalleryWheelHandler({
    slideCount: 10,
    getActiveIndex: () => active,
    onNavigate(index) {
      destinations.push(index)
      active = index
    },
  })
  return { handleWheel, destinations }
}

test('vertical wheel gestures browse next and previous paintings', () => {
  const { handleWheel, destinations } = wheelGallery(3)
  const down = wheelEvent()
  handleWheel(down)
  const up = wheelEvent({ deltaY: -100, timeStamp: 1000 })
  handleWheel(up)

  assert.deepEqual(destinations, [4, 3])
  assert.ok(down.defaultPrevented)
  assert.ok(up.defaultPrevented)
})

test('wheel momentum cannot skip multiple paintings in the same gesture', () => {
  const { handleWheel, destinations } = wheelGallery()
  for (const timeStamp of [0, 30, 60, 100, 160, 220]) {
    handleWheel(wheelEvent({ timeStamp }))
  }
  assert.deepEqual(destinations, [1])

  handleWheel(wheelEvent({ timeStamp: 1000 }))
  assert.deepEqual(destinations, [1, 2])
})

test('small wheel deltas accumulate and line/page scrolling also navigates', () => {
  const { handleWheel, destinations } = wheelGallery()
  handleWheel(wheelEvent({ deltaY: 12 }))
  assert.deepEqual(destinations, [])
  handleWheel(wheelEvent({ deltaY: 20, timeStamp: 30 }))
  handleWheel(wheelEvent({ deltaY: 2, deltaMode: 1, timeStamp: 1000 }))
  handleWheel(wheelEvent({ deltaY: 1, deltaMode: 2, timeStamp: 2000 }))
  assert.deepEqual(destinations, [1, 2, 3])
})

test('horizontal trackpad scrolling and browser zoom remain native', () => {
  const { handleWheel, destinations } = wheelGallery(3)
  for (const overrides of [
    { deltaX: 100, deltaY: 4 },
    { ctrlKey: true },
    { deltaY: 0 },
  ]) {
    const event = wheelEvent(overrides)
    handleWheel(event)
    assert.equal(event.defaultPrevented, false)
  }
  assert.deepEqual(destinations, [])
})

test('wheel navigation does not trap scrolling at collection boundaries', () => {
  for (const [active, deltaY] of [[0, -100], [9, 100]]) {
    const { handleWheel, destinations } = wheelGallery(active)
    const event = wheelEvent({ deltaY })
    handleWheel(event)
    assert.deepEqual(destinations, [])
    assert.equal(event.defaultPrevented, false)
  }
})

test('separate wheel gestures wait 800ms before another painting can advance', () => {
  const { handleWheel, destinations } = wheelGallery(3)
  handleWheel(wheelEvent())

  for (const timeStamp of [300, 600, 799]) {
    const event = wheelEvent({ timeStamp })
    handleWheel(event)
    assert.ok(event.defaultPrevented)
    assert.deepEqual(destinations, [4])
  }

  handleWheel(wheelEvent({ timeStamp: 800 }))
  assert.deepEqual(destinations, [4, 5])
})
