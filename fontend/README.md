# Sujal's Challenge frontend

React 19 + Vite 8 frontend for the NedsShop artwork gallery and auction learning
project. The current app previews two collections of ten planned works each:
ten images in the first and one supplied image in the second. Artist stories,
materials, dimensions and condition are included. Starting prices use AUD;
Unseen starts at $30 and the remaining second-collection prices await
confirmation. Purchases and bids are not open.

The directory name `fontend` is intentional in the commands below: it matches
this repository's existing spelling.

## Run locally

Use Node.js 22.13+ within the 22.x release line, or Node.js 24+, and npm to
satisfy the installed Vite and ESLint requirements.

From the repository root in PowerShell:

```powershell
Set-Location fontend
npm ci
npm run dev
```

Open the local URL printed by Vite. No backend service or environment variables
are needed for the current gallery.

Run these commands from `fontend`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot updates. |
| `npm run lint` | Check JavaScript and JSX with ESLint. |
| `npm test` | Run utility and server-rendered gallery regression tests. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally; run the build first. |

## Current gallery

- Click the exhibition title to switch between the first and second collections.
  Switching resets the gallery to its first available work and clears artwork
  information. The exhibition count distinguishes available images from the ten
  planned works; gallery paging counts only available images.
- Full-width horizontal scroll-snap exhibits, previous/next buttons and touch
  swiping. Resizing keeps the current slide aligned.
- Mouse-wheel scrolling moves one painting per gesture, with an 800ms pause
  between advances for a slower browsing pace. Horizontal trackpad
  scrolling and touch swiping remain native; zoom gestures and information-dialog
  scrolling are unaffected.
- Wheel, arrow-button and keyboard transitions ease over 800ms. Direct gestures
  interrupt the animation; reduced-motion navigation remains instant.
- Keyboard navigation when the gallery itself has focus: Left/Right to move,
  Home for the first work and End for the last.
- A vintage gallery palette: dark olive plaster (`#383d34`), walnut frames,
  parchment labels and restrained brass accents. The artwork is the centerpiece.
- Portrait frames with static CSS depth, recessed mats and subtle glass
  highlights. Images retain their full aspect ratio; no WebGL is required.
- On screens wider than 900px, the frame is centered with an information panel
  and starting-price plaque to its right. At 900px and below, the plaques sit
  beneath the frame; short landscape windows keep them beside it.
- Guide plaques show the work's title, collection number and starting price in
  AUD. Decorative wires, screws, the extra toolbar and progress marks are removed.
- A compact 28px information bubble on each frame retains a 44px touch target
  and opens a native modal dialog containing
  collection notes, artwork details, framing, starting price and collection/postage
  information. Escape, the close button or clicking the dialog backdrop dismisses it.
- The information dialog uses a compact header and two-column fact layout to fit
  its current notes in one view, with extra compact layouts for phones and short
  landscape screens. Scrolling remains available for larger text or longer notes.
- A skip link, inactive slides excluded from focus, native modal focus handling
  and reduced-motion support. Reduced motion disables smooth navigation and
  the frame's slight static rotation.
- A footer disclosure that the pieces are copies, imitations or studies of
  AI-modified, AI-generated or inspired artwork, rather than originals by the
  referenced artists.

Login, bid submission, payments and backend requests are not implemented.
The starting-price plaque is a display component, not a bidding form.

## Source guide

| File or folder | Responsibility |
| --- | --- |
| `src/main.jsx` | Mount the React application. |
| `src/App.jsx` | Header, collection switch, exhibition count, gallery and footer. |
| `src/components/gallery/GalleryWall.jsx` | Scrolling, active slide, navigation and selected dialog. |
| `src/components/gallery/ArtworkDisplay.jsx` | Centered frame and guide-plaque layout. |
| `src/components/gallery/ArtworkFrame.jsx` | Artwork image, digital frame and information button. |
| `src/components/gallery/ArtworkInfoDialog.jsx` | Modal artwork details. |
| `src/components/bidding/BidPlaque.jsx` | Display the starting price in AUD. |
| `src/data/artworks.js` | Two collections, planned counts, artwork/image mapping and legacy exports. |
| `src/utils/formatters.js` | Shared AUD price and artwork-number formatting. |
| `src/utils/galleryNavigation.js` | Shared bounds for requested and scrolled slide indices. |
| `src/utils/animateGalleryScroll.js` | Cancelable 800ms painting transitions with gentle easing. |
| `src/assets/` | Numbered artwork JPGs imported by Vite. |
| `src/styles/` | Global styles and gallery presentation. |
| `tests/` | Node tests for utilities, artwork contracts and rendered gallery behavior. |

Empty auth, fundraising, navigation and bid-form scaffolds have been removed.
The pages, hooks and services directories remain reserved for future work.
The public starter SVGs remain available to preserve their existing URLs.

## Update the collections

Edit `collectionDefinitions` in `src/data/artworks.js`. Both collections use
the same object structure: collection metadata, a `defaults` object for shared
details, and an `artworks` array of objects. Each artwork keeps its `image`,
`title`, `description`, `medium`, `priceCents` and optional `alt` together.
Artwork fields override collection defaults. Amounts are stored in cents:
`1500` means AUD $15. The current formatter displays whole dollars, so
fractional-dollar prices will be rounded for display.

The first collection lists images `1.jpg` through `10.jpg`. The existing
`artworks` export remains available as an alias of the first collection's
resolved artwork list. The `collections` export resolves image URLs and adds
collection labels and display numbers for the gallery.

The second collection uses `src/assets/11.jpg` through `src/assets/20.jpg`,
including only images that exist. `11.jpg` is its work 01. Add `12.jpg` through
`20.jpg` as they become available; they appear automatically in numbered order
without showing empty slides. Edit each artwork object's `priceCents` when
prices are confirmed. `null` displays
"To be confirmed" in the price plaque and information dialog.

Replace the numbered files to change the photos. If you change file types,
update the `.jpg` glob and each object's `image` filename. Set each collection's
`plannedWorkCount` if its planned size changes. The exhibition note uses
available and planned counts; gallery controls use the selected collection's
available artwork count.

Future second-collection works retain placeholder titles, descriptions and
unconfirmed prices. Update those objects as details become available.
All pieces are unframed works on paper; the frame is a digital presentation.
Frontend data and bundled images are public, so keep private records and secrets
out of these files.

## Validation and compatibility

The Node test runner uses the existing Vite and React dependencies to check
currency rounding, number formatting, carousel bounds, both collections' image
records, the collection-switch control, one-image navigation bounds, initial
gallery accessibility, dialog content and unconfirmed prices. No test
dependencies are added.
The legacy `formatPrice` export from `src/data/artworks.js` remains available;
the implementation now lives in `src/utils/formatters.js`.

This is a JavaScript project with no configured TypeScript checker. Production
build and ESLint validate source syntax and imports. Server rendering does not
exercise collection switching, browser-only scrolling, resize observation or
native modal focus and dismissal; those still need an interactive browser check.

## Project documentation

- [Project structure](../README.md)
