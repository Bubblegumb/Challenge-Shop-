import { formatArtworkNumber } from '../utils/formatters'

// Preserve the existing import path for callers of the data module.
export { formatPrice } from '../utils/formatters'

const photos = import.meta.glob('../assets/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

// Both collections use the same structure. Keep each work's details together.
// Prices are in cents: 3000 means AUD $30; null means not yet confirmed.
// Missing images stay hidden until their numbered JPG is added to src/assets.
const collectionDefinitions = [
  {
    id: 'first-collection',
    title: 'The first collection',
    plannedWorkCount: 10,
    defaults: {
      medium: 'To be confirmed',
      dimensions: '14 cm wide × 20 cm long',
    },
    artworks: [
      {
        id: 'study-1',
        image: '1.jpg',
        title: 'Study No. 01',
        description: 'On the way back from my first walk, I spotted a vintage car and immediately wanted to draw it. That unexpected moment became the inspiration for this piece.',
        medium: 'Coloured pencil on paper',
        priceCents: 1500,
        alt: 'Photograph of artwork 1 in the first collection',
      },
      {
        id: 'study-2',
        image: '2.jpg',
        title: 'Study No. 02',
        description: 'I originally planned to draw a tiger, but my chosen reference felt too challenging. A little Pinterest inspiration led me to something simpler that still felt really cool.',
        medium: 'Pencil shading on paper',
        priceCents: 1500,
        alt: 'Photograph of artwork 2 in the first collection',
      },
      {
        id: 'study-3',
        image: '3.jpg',
        title: 'Study No. 03',
        description: 'My first acrylic painting taught me that ordinary paper handles layers differently from canvas paper. Getting it right took patience, plenty of effort, and a lot of learning.',
        medium: 'Acrylic on paper',
        priceCents: 1500,
        alt: 'Photograph of artwork 3 in the first collection',
      },
      {
        id: 'study-4',
        image: '4.jpg',
        title: 'Study No. 04',
        description: 'For my second acrylic painting, I chose a cute origami girl. After the challenges of my first attempt, I was beginning to get a feel for the paint.',
        medium: 'Acrylic on paper',
        priceCents: 1000,
        alt: 'Photograph of artwork 4 in the first collection',
      },
      {
        id: 'study-5',
        image: '5.jpg',
        title: 'Study No. 05',
        description: 'I found a lighthouse that looked really cool without being too complicated. Its simplicity drew me in, and I wanted to see how I could capture it myself.',
        medium: 'Pencil on paper',
        priceCents: 1500,
        alt: 'Photograph of artwork 5 in the first collection',
      },
      {
        id: 'study-6',
        image: '6.jpg',
        title: 'Study No. 06',
        description: 'The week before, I had promised a colour version of my lighthouse. This time, I watered down my acrylics and really enjoyed seeing the painting come to life.',
        medium: 'Diluted acrylic on paper',
        priceCents: 2500,
        alt: 'Photograph of artwork 6 in the first collection',
      },
      {
        id: 'study-7',
        image: '7.jpg',
        title: 'Study No. 07',
        description: 'I really enjoy colouring birds, so when the chance came along, I took it. This piece came from the simple pleasure of spending time on a subject I love.',
        medium: 'Acrylic on paper',
        priceCents: 2500,
        alt: 'Photograph of artwork 7 in the first collection',
      },
      {
        id: 'study-8',
        image: '8.jpg',
        title: 'Study No. 08',
        description: 'I bought an EE grade pencil and loved the pitch black colour it produced. I wanted to try it out, and this drawing was the result of that curiosity.',
        medium: 'EE grade pencil on paper',
        priceCents: 2000,
        alt: 'Photograph of artwork 8 in the first collection',
      },
      {
        id: 'study-9',
        image: '9.jpg',
        title: 'Study No. 09',
        description: 'A sunny day ended with a beautiful sunset that I wanted to remember. I reached for my acrylics, hoping to capture a little of what I had just seen.',
        medium: 'Acrylic on paper',
        priceCents: 1500,
        alt: 'Photograph of artwork 9 in the first collection',
      },
      {
        id: 'study-10',
        image: '10.jpg',
        title: 'Study No. 10',
        description: 'I finished the collection with a teddy bear drawn in black pen. It looked like a simple subject, but getting it right was much harder than it seemed.',
        medium: 'Black pen on paper',
        priceCents: 1000,
        alt: 'Photograph of artwork 10 in the first collection',
      },
    ],
  },
  {
    id: 'second-collection',
    title: 'The second collection',
    plannedWorkCount: 10,
    defaults: {
      medium: 'Acrylic on canvas paper',
      dimensions: '14.5 cm wide × 19.5 cm long',
    },
    artworks: [
      {
        id: 'second-study-1',
        image: '11.jpg',
        title: 'Unseen',
        description: '“What if I were homeless?” I imagined feeling unseen, surrounded by people enjoying life, with no one and nowhere to share mine. This piece is for those people.',
        priceCents: 3000,
        alt: 'Photograph of Unseen in the second collection',
      },
      {
        id: 'second-study-2',
        image: '12.jpg',
        title: 'Study No. 02',
        priceCents: null,
      },
      {
        id: 'second-study-3',
        image: '13.jpg',
        title: 'Study No. 03',
        priceCents: null,
      },
      {
        id: 'second-study-4',
        image: '14.jpg',
        title: 'Study No. 04',
        priceCents: null,
      },
      {
        id: 'second-study-5',
        image: '15.jpg',
        title: 'Study No. 05',
        priceCents: null,
      },
      {
        id: 'second-study-6',
        image: '16.jpg',
        title: 'Study No. 06',
        priceCents: null,
      },
      {
        id: 'second-study-7',
        image: '17.jpg',
        title: 'Study No. 07',
        priceCents: null,
      },
      {
        id: 'second-study-8',
        image: '18.jpg',
        title: 'Study No. 08',
        priceCents: null,
      },
      {
        id: 'second-study-9',
        image: '19.jpg',
        title: 'Study No. 09',
        priceCents: null,
      },
      {
        id: 'second-study-10',
        image: '20.jpg',
        title: 'Study No. 10',
        priceCents: null,
      },
    ],
  },
]

// Resolve image URLs and apply shared details without changing the source records.
export const collections = collectionDefinitions.map(({ defaults, artworks: works, ...collection }) => ({
  ...collection,
  artworks: works.flatMap(({ image, ...artwork }, index) => {
    const imageUrl = photos[`../assets/${image}`]
    if (!imageUrl) return []

    return [{
      condition: 'Good',
      frame: 'Unframed artwork on paper. The frame shown is for digital display only.',
      ...defaults,
      ...artwork,
      number: formatArtworkNumber(index + 1),
      collectionTitle: collection.title,
      imageUrl,
      alt: artwork.alt ?? `Photograph of artwork ${index + 1} in ${collection.title.toLowerCase()}`,
      description: artwork.description ?? `A piece from ${collection.title.toLowerCase()}. The story behind this work and its reference credits will be added soon.`,
    }]
  }),
}))

// Keep the original first-collection export available to existing callers.
export const artworks = collections[0].artworks
