import assert from 'node:assert/strict'
import { readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
let server
let artworkData
let formatters
let GalleryWall
let ArtworkFrame
let ArtworkInfoDialog
let BidPlaque
let BidDialog
let OwnerPage
let App

before(async () => {
  server = await createServer({
    root: projectRoot,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
  })

  const modules = await Promise.all([
    server.ssrLoadModule('/src/data/artworks.js'),
    server.ssrLoadModule('/src/utils/formatters.js'),
    server.ssrLoadModule('/src/components/gallery/GalleryWall.jsx'),
    server.ssrLoadModule('/src/components/gallery/ArtworkFrame.jsx'),
    server.ssrLoadModule('/src/components/gallery/ArtworkInfoDialog.jsx'),
    server.ssrLoadModule('/src/components/bidding/BidPlaque.jsx'),
    server.ssrLoadModule('/src/App.jsx'),
    server.ssrLoadModule('/src/components/bidding/BidDialog.jsx'),
    server.ssrLoadModule('/src/pages/OwnerPage.jsx'),
  ])
  artworkData = modules[0]
  formatters = modules[1]
  GalleryWall = modules[2].default
  ArtworkFrame = modules[3].default
  ArtworkInfoDialog = modules[4].default
  BidPlaque = modules[5].default
  App = modules[6].default
  BidDialog = modules[7].default
  OwnerPage = modules[8].default
})

after(async () => {
  await server?.close()
})

test('all ten artwork records retain stable IDs, valid cent prices and resolving image URLs', async () => {
  assert.equal(artworkData.artworks.length, 10)
  assert.equal(new Set(artworkData.artworks.map(artwork => artwork.id)).size, 10)

  await Promise.all(artworkData.artworks.map(async (artwork, index) => {
    assert.equal(artwork.id, `study-${index + 1}`)
    assert.ok(Number.isInteger(artwork.priceCents), `${artwork.id} price must use integer cents`)
    assert.equal(artwork.priceCents, 1000, `${artwork.id} must start at $10`)
    assert.equal(artwork.number, formatters.formatArtworkNumber(index + 1))
    assert.equal(artwork.title, `Study No. ${artwork.number}`)
    assert.equal(typeof artwork.imageUrl, 'string')

    const imagePath = decodeURIComponent(new URL(artwork.imageUrl, 'http://localhost').pathname)
    assert.equal(imagePath, `/src/assets/${index + 1}.jpg`)
    assert.ok((await stat(resolve(projectRoot, imagePath.slice(1)))).isFile())
  }))
})

test('both collections plan ten works and the second includes only supplied images', async () => {
  const [first, second] = artworkData.collections
  assert.equal(artworkData.collections.length, 2)
  assert.equal(first.id, 'first-collection')
  assert.equal(first.title, 'The first collection')
  assert.equal(first.artworks, artworkData.artworks)
  assert.equal(second.id, 'second-collection')
  assert.equal(second.title, 'The second collection')
  assert.equal(first.plannedWorkCount, 10)
  assert.equal(second.plannedWorkCount, 10)

  const photoNumbers = (await readdir(resolve(projectRoot, 'src/assets')))
    .map(name => /^(\d+)\.jpg$/.exec(name))
    .filter(Boolean)
    .map(match => Number(match[1]))
    .filter(number => number >= 11 && number <= 20)
    .sort((a, b) => a - b)
  assert.equal(photoNumbers[0], 11)
  assert.equal(second.artworks.length, photoNumbers.length)

  for (const [index, artwork] of second.artworks.entries()) {
    const workNumber = photoNumbers[index] - 10
    assert.equal(artwork.id, `second-study-${workNumber}`)
    assert.equal(artwork.number, formatters.formatArtworkNumber(workNumber))
    assert.equal(artwork.collectionTitle, second.title)
    assert.equal(artwork.priceCents, 1000)
    const imagePath = decodeURIComponent(new URL(artwork.imageUrl, 'http://localhost').pathname)
    assert.equal(imagePath, `/src/assets/${photoNumbers[index]}.jpg`)
    assert.ok((await stat(resolve(projectRoot, imagePath.slice(1)))).isFile())
  }

  const allArtworks = artworkData.collections.flatMap(collection => collection.artworks)
  assert.equal(new Set(allArtworks.map(artwork => artwork.id)).size, allArtworks.length)
  for (const artwork of first.artworks) assert.equal(artwork.collectionTitle, first.title)
})

test('the legacy artwork-data formatter export remains the shared formatter', () => {
  assert.equal(artworkData.formatPrice, formatters.formatPrice)
  assert.equal(artworkData.formatPrice(1550), '$16')
})

test('the initial gallery exposes one accessible slide and correct navigation bounds', () => {
  const markup = renderToStaticMarkup(createElement(GalleryWall))
  const slides = [...markup.matchAll(/<div\b(?=[^>]*\bclass="artwork-slide")([^>]*)>/g)]
  assert.equal(slides.length, 10)
  assert.match(slides[0][1], /\baria-hidden="false"/)
  assert.doesNotMatch(slides[0][1], /\binert(?:=|\s|$)/)

  for (const [, attributes] of slides.slice(1)) {
    assert.match(attributes, /\baria-hidden="true"/)
    assert.match(attributes, /\binert(?:=|\s|$)/)
  }

  assert.match(markup, /\baria-label="Artwork 1 of 10"/)
  const buttons = [...markup.matchAll(/<button\b([^>]*)>/g)].map(match => match[1])
  const previous = buttons.find(attributes => attributes.includes('aria-label="Previous artwork"'))
  const next = buttons.find(attributes => attributes.includes('aria-label="Next artwork"'))
  assert.ok(previous)
  assert.ok(next)
  assert.match(previous, /\bdisabled(?:=|\s|$)/)
  assert.doesNotMatch(next, /\bdisabled(?:=|\s|$)/)
})

test('the exhibition title is a collection switch with an accessible destination', () => {
  const markup = renderToStaticMarkup(createElement(App))
  assert.match(markup, /<button\b[^>]*aria-label="The first collection\. Switch to the second collection\."/)
  assert.match(markup, /<button\b[^>]*aria-controls="gallery"/)
  assert.match(markup, /10 works/)
})

test('a one-work second collection has correct labels and disables both navigation buttons', () => {
  const second = artworkData.collections[1]
  const collection = { ...second, artworks: second.artworks.slice(0, 1) }
  const markup = renderToStaticMarkup(createElement(GalleryWall, { collection }))
  const slides = [...markup.matchAll(/<div\b(?=[^>]*\bclass="artwork-slide")([^>]*)>/g)]
  assert.equal(slides.length, 1)
  assert.match(slides[0][1], /\baria-hidden="false"/)
  assert.doesNotMatch(slides[0][1], /\binert(?:=|\s|$)/)
  assert.match(markup, /\baria-label="Artwork 1 of 1"/)
  assert.ok(markup.includes(`${second.title} / ${collection.artworks[0].number}`))
  assert.doesNotMatch(markup, /The first collection/)

  const buttons = [...markup.matchAll(/<button\b([^>]*)>/g)].map(match => match[1])
  for (const label of ['Previous artwork', 'Next artwork']) {
    const attributes = buttons.find(attributes => attributes.includes(`aria-label="${label}"`))
    assert.ok(attributes)
    assert.match(attributes, /\bdisabled(?:=|\s|$)/)
  }
})

test('the information button passes its own artwork to the selection callback', () => {
  const artwork = artworkData.artworks[4]
  let selected
  const frame = ArtworkFrame({ artwork, onInfo: value => { selected = value } })
  const infoButton = frame.props.children.find(child => child.type === 'button')

  assert.equal(infoButton.props['aria-haspopup'], 'dialog')
  assert.equal(infoButton.props['aria-label'], `Information about ${artwork.title}`)
  infoButton.props.onClick()
  assert.equal(selected, artwork)
})

test('selected artwork information retains the description and six guide facts', () => {
  const artwork = {
    ...artworkData.artworks[0],
    description: 'A study of light in a quiet room.',
    medium: 'Oil on linen',
    dimensions: '30 x 40 cm',
    condition: 'Minor wear at the edges',
    frame: 'Walnut frame included.',
  }
  const markup = renderToStaticMarkup(createElement(ArtworkInfoDialog, { artwork, onClose() {} }))
  const facts = Object.fromEntries([...markup.matchAll(/<dt>([^<]*)<\/dt><dd>([^<]*)<\/dd>/g)].map(match => [match[1], match[2]]))

  assert.deepEqual(Object.keys(facts), ['Medium', 'Dimensions', 'Condition', 'Starting price', 'Framing', 'Collection'])
  assert.equal(facts.Medium, artwork.medium)
  assert.equal(facts.Dimensions, artwork.dimensions)
  assert.equal(facts.Condition, artwork.condition)
  assert.equal(facts['Starting price'], `${formatters.formatPrice(artwork.priceCents)} AUD`)
  assert.equal(facts.Framing, artwork.frame)
    assert.match(facts.Collection, /Collection at the State Library during a one-hour window/)
  assert.ok(markup.includes(artwork.description))
  assert.match(markup, /\baria-labelledby="dialog-title"/)
  assert.match(markup, /\baria-describedby="dialog-description"/)
  assert.match(markup, /\baria-label="Close artwork information"/)
})

test('unconfirmed starting prices remain unconfirmed in the plaque and second-collection dialog', () => {
  const artwork = { ...artworkData.collections[1].artworks[0], priceCents: null }
  const plaque = renderToStaticMarkup(createElement(BidPlaque, { artwork }))
  const dialog = renderToStaticMarkup(createElement(ArtworkInfoDialog, { artwork, onClose() {} }))
  assert.ok(plaque.includes('To be confirmed'))
  assert.match(dialog, /<dt>Starting price<\/dt><dd>To be confirmed<\/dd>/)
  assert.ok(dialog.includes(`${artwork.collectionTitle} / ${artwork.number}`))
  assert.doesNotMatch(plaque + dialog, /\$0|\$NaN/)
})

test('an unselected information dialog has no stale artwork details', () => {
  const markup = renderToStaticMarkup(createElement(ArtworkInfoDialog, { artwork: null, onClose() {} }))
  assert.doesNotMatch(markup, /<dt>|id="dialog-title"|id="dialog-description"/)
})

test('live bid plaques show exact cents and disable new submissions after closing', () => {
  const artwork = artworkData.artworks[0]
  const open = renderToStaticMarkup(createElement(BidPlaque, {
    artwork, lot: { highest_amount_cents: 1551 }, canBid: true, onBid() {},
  }))
  assert.match(open, /Highest bid/)
  assert.match(open, /\$15\.51/)
  assert.match(open, /Unframed/)
  assert.doesNotMatch(open, /<button[^>]*disabled/)
  const closed = renderToStaticMarkup(createElement(BidPlaque, {
    artwork, closed: true, onBid() {},
  }))
  assert.match(closed, /<button[^>]*disabled/)
  assert.match(closed, /Bidding closed/)
})

test('guest bidding collects only amount and contact details with clear payment and collection instructions', () => {
  const markup = renderToStaticMarkup(createElement(BidDialog, {
    artwork: artworkData.artworks[0], lot: { highest_amount_cents: 1551 }, onClose() {}, onAccepted() {},
  }))
  const visibleInputNames = [...markup.matchAll(/<input[^>]*name="([^"]+)"/g)]
    .map(match => match[1]).filter(name => name !== 'website')
  assert.deepEqual(visibleInputNames, ['amount', 'name', 'email'])
  assert.match(markup, /Minimum bid: \$15\.52 AUD/)
  assert.match(markup, /Maximum: \$75\.00 AUD/)
  assert.match(markup, /Send verification code/)
  assert.match(markup, /first verified \$75 bid secures this artwork/)
  assert.match(markup, /Unframed artwork\. No frame is included/)
  assert.match(markup, /State Library during a one-hour window/)
  assert.match(markup, /donate your exact winning bid/)
  assert.doesNotMatch(markup, /name="password"|name="phone"/)
})

test('a secured artwork disables bidding before the auction deadline', () => {
  const artwork = artworkData.artworks[0]
  const lot = { highest_amount_cents: 7500, locked: true }
  const plaque = renderToStaticMarkup(createElement(BidPlaque, { artwork, lot, canBid: true, onBid() {} }))
  assert.match(plaque, /Secured at \$75/)
  assert.match(plaque, /Artwork secured/)
  assert.match(plaque, /<button[^>]*disabled/)
  const dialog = renderToStaticMarkup(createElement(BidDialog, { artwork, lot, onClose() {}, onAccepted() {} }))
  assert.match(dialog, /This artwork is secured at \$75\.00 AUD/)
  assert.match(dialog, /<button type="submit"[^>]*disabled/)
  assert.doesNotMatch(dialog, /Minimum bid: \$75\.01/)
})

test('owner page exposes no bidder contacts before owner authentication', () => {
  const markup = renderToStaticMarkup(createElement(OwnerPage))
  assert.match(markup, /type="password"/)
  assert.match(markup, /Bidders do not need an account/)
  assert.doesNotMatch(markup, /<table|Highest bids and collection payments/)
})
