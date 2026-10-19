const priceFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
})

export function formatPrice(cents) {
  return priceFormatter.format(cents / 100)
}

export function formatArtworkNumber(value) {
  return String(value).padStart(2, '0')
}
