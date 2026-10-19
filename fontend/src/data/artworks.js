import { formatArtworkNumber } from '../utils/formatters'

// Preserve the existing import path for callers of the data module.
export { formatPrice } from '../utils/formatters'

// Update titles, details, and sample prices here. Amounts are in cents.
const startingPrices = [1500, 1500, 1500, 1000, 1500, 2500, 2500, 2000, 1500, 1000]
const photos = import.meta.glob('../assets/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const artworks = startingPrices.map((priceCents, index) => {
  const workNumber = index + 1
  const number = formatArtworkNumber(workNumber)

  return {
    id: `study-${workNumber}`,
    number,
    title: `Study No. ${number}`,
    imageUrl: photos[`../assets/${workNumber}.jpg`],
    alt: `Photograph of artwork ${workNumber} in Sujal’s collection`,
    description: 'A piece from the first collection. The story behind this work and its reference credits will be added soon.',
    medium: 'To be confirmed',
    dimensions: 'To be confirmed',
    condition: 'To be confirmed',
    frame: 'The frame shown is a digital gallery presentation. Physical framing details to be confirmed.',
    priceCents,
  }
})
