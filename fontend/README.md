# Sujal's Challenge frontend

React 19 + Vite 8 frontend for the NedsShop artwork gallery and auction learning
project. The current app is a gallery preview of ten works, with placeholder
artwork details and starting prices in AUD. Purchases and bids are not open.

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
| `src/App.jsx` | Header, exhibition note, gallery and footer. |
| `src/components/gallery/GalleryWall.jsx` | Scrolling, active slide, navigation and selected dialog. |
| `src/components/gallery/ArtworkDisplay.jsx` | Centered frame and guide-plaque layout. |
| `src/components/gallery/ArtworkFrame.jsx` | Artwork image, digital frame and information button. |
| `src/components/gallery/ArtworkInfoDialog.jsx` | Modal artwork details. |
| `src/components/bidding/BidPlaque.jsx` | Display the starting price in AUD. |
| `src/data/artworks.js` | Artwork records, image mapping and legacy formatter re-export. |
| `src/utils/formatters.js` | Shared AUD price and artwork-number formatting. |
| `src/utils/galleryNavigation.js` | Shared bounds for requested and scrolled slide indices. |
| `src/utils/animateGalleryScroll.js` | Cancelable 800ms painting transitions with gentle easing. |
| `src/assets/` | Numbered artwork JPGs imported by Vite. |
| `src/styles/` | Global styles and gallery presentation. |
| `tests/` | Node tests for utilities, artwork contracts and rendered gallery behavior. |

Empty auth, fundraising, navigation and bid-form scaffolds have been removed.
The pages, hooks and services directories remain reserved for future work.
The public starter SVGs remain available to preserve their existing URLs.

## Update the collection

Edit `src/data/artworks.js` to change titles, descriptions, alt text, medium,
dimensions, condition, framing and `priceCents`. Amounts are stored in cents:
`1500` means AUD $15. The current formatter displays whole dollars, so
fractional-dollar prices will be rounded for display.

The starting-price list currently creates ten records and maps them to
`src/assets/1.jpg` through `src/assets/10.jpg`. Replace those files to change
the photos. If you change file types, update the `.jpg` glob and image mapping.
If you add or remove works, update the price list and corresponding photos. The collection
count in `src/App.jsx` and gallery controls both derive from `artworks.length`.

Titles, prices and artwork details are placeholders. Replace them with confirmed
information and meaningful image descriptions before presenting a finished
collection. The frame is a digital presentation; physical framing is unconfirmed.
Frontend data and bundled images are public, so keep private records and secrets
out of these files.

## Validation and compatibility

The Node test runner uses the existing Vite and React dependencies to check
currency rounding, number formatting, carousel bounds, artwork/image records,
initial gallery accessibility and dialog content. No test dependencies are added.
The legacy `formatPrice` export from `src/data/artworks.js` remains available;
the implementation now lives in `src/utils/formatters.js`.

This is a JavaScript project with no configured TypeScript checker. Production
build and ESLint validate source syntax and imports. Server rendering does not
exercise browser-only scrolling, resize observation or native modal focus and
dismissal; those still need an interactive browser check.

## Project documentation

- [Project structure](../README.md)
