import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AUCTION_CLOSES_AT, biddingClosed, formatBid, parseBidCents } from '../src/utils/bidding.js'

test('bid amounts preserve exact cents and reject invalid or sub-$10 input', () => {
  assert.equal(parseBidCents('10'), 1000)
  assert.equal(parseBidCents('10.01'), 1001)
  assert.equal(parseBidCents('15.50'), 1550)
  for (const invalid of ['', '9.99', '-10', '10.001', '1e4', 'Infinity', '1000001']) {
    assert.equal(parseBidCents(invalid), null)
  }
  assert.equal(formatBid(1551), '$15.51')
})

test('bidding closes at noon Sydney and stays closed at the exact boundary', () => {
  const cutoff = Date.parse(AUCTION_CLOSES_AT)
  assert.equal(biddingClosed(AUCTION_CLOSES_AT, cutoff - 1), false)
  assert.equal(biddingClosed(AUCTION_CLOSES_AT, cutoff), true)
  assert.equal(biddingClosed(AUCTION_CLOSES_AT, cutoff + 1), true)
  assert.match(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hour12: true }).format(cutoff), /12 pm/)
})
