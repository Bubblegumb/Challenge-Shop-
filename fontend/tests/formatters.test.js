import assert from 'node:assert/strict'
import test from 'node:test'
import { formatArtworkNumber, formatPrice } from '../src/utils/formatters.js'

test('prices preserve whole-dollar AUD formatting and rounding from cents', () => {
  const cases = [
    [0, '$0'],
    [49, '$0'],
    [50, '$1'],
    [1500, '$15'],
    [1549, '$15'],
    [1550, '$16'],
    [-50, '-$1'],
    [123456789, '$1,234,568'],
  ]

  for (const [cents, expected] of cases) {
    assert.equal(formatPrice(cents), expected, `${cents} cents`)
  }
})

test('artwork numbers retain leading zeroes without truncating longer numbers', () => {
  for (const [value, expected] of [[1, '01'], [9, '09'], [10, '10'], [100, '100']]) {
    assert.equal(formatArtworkNumber(value), expected)
  }
})
