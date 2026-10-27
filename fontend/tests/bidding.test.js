import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AUCTION_CLOSES_AT, AUCTION_DEADLINE_LABEL, BID_CAP_CENTS, biddingClosed, formatBid, parseBidCents } from '../src/utils/bidding.js'

test('bid amounts preserve exact cents and reject invalid or sub-$10 input', () => {
  assert.equal(parseBidCents('10'), 1000)
  assert.equal(parseBidCents('10.01'), 1001)
  assert.equal(parseBidCents('15.50'), 1550)
  assert.equal(parseBidCents('74.99'), 7499)
  assert.equal(parseBidCents('75'), BID_CAP_CENTS)
  assert.equal(parseBidCents('75.00'), BID_CAP_CENTS)
  for (const invalid of ['', '9.99', '-10', '10.001', '1e4', 'Infinity', '75.01', '76', '1000001']) {
    assert.equal(parseBidCents(invalid), null)
  }
  assert.equal(formatBid(1551), '$15.51')
})

test('bidding closes at 11:59 pm on 28 October Sydney time and stays closed at the exact boundary', () => {
  const cutoff = Date.parse(AUCTION_CLOSES_AT)
  assert.equal(AUCTION_CLOSES_AT, '2026-10-28T12:59:00.000Z')
  assert.equal(AUCTION_DEADLINE_LABEL, '28 October 2026 at 11:59 pm (Sydney time)')
  assert.equal(biddingClosed(AUCTION_CLOSES_AT, Date.parse('2026-10-28T12:00:00+11:00')), false)
  assert.equal(biddingClosed(AUCTION_CLOSES_AT, cutoff - 1), false)
  assert.equal(biddingClosed(AUCTION_CLOSES_AT, cutoff), true)
  assert.equal(biddingClosed(AUCTION_CLOSES_AT, cutoff + 1), true)
  assert.equal(new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', dateStyle: 'long', timeStyle: 'short',
  }).format(cutoff), '28 October 2026 at 11:59 pm')
})
