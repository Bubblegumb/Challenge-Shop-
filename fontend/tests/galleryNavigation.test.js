import assert from 'node:assert/strict'
import test from 'node:test'
import { clampSlideIndex } from '../src/utils/galleryNavigation.js'

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
