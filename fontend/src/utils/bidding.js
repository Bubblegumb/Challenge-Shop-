export const AUCTION_CLOSES_AT = '2026-10-28T01:00:00.000Z'
export const AUCTION_DEADLINE_LABEL = '28 October 2026 at 12 noon (Sydney time)'
export const COLLECTION_NOTE = 'Collection at the State Library during a one-hour window. The date, time and meeting point will be confirmed by email once the space is booked.'

export function parseBidCents(value) {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null
  const [dollars, cents = ''] = value.split('.')
  const result = Number(dollars) * 100 + Number(cents.padEnd(2, '0'))
  return result >= 1000 && result <= 100000000 ? result : null
}

export function formatBid(cents) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function biddingClosed(closesAt, now = Date.now()) {
  return now >= Date.parse(closesAt)
}
