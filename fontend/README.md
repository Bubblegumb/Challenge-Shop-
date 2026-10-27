# Sujal's Challenge frontend

React 19 + Vite 8 gallery with Supabase email-verified bidding. The first collection
shows ten pieces and the second currently shows five. Every piece starts at
AUD $10 and has an AUD $75 cap. The first accepted $75 bid locks that artwork.
Other artworks close at 11:59 pm on 28 October 2026, Sydney time.

Follow the [Supabase setup guide](../supabase/README.md) to connect the database,
configure Auth email codes and SMTP, set owner access, and schedule winner emails. The gallery
can preview before setup; live bidding remains unavailable until configured.

The directory name `fontend` is intentional in the commands below: it matches
this repository's existing spelling.

## Run locally

Use Node.js 22.22.2+ within the 22.x release line, Node.js 24.15+, or Node.js 26+
and npm to satisfy the build tools and jsdom test requirements.

From the repository root in PowerShell:

```powershell
Set-Location fontend
npm ci
npm run dev
```

Open the local URL printed by Vite. Use `.env.example` to prepare `.env.local`
for Supabase. The gallery can preview without credentials.

Run these commands from `fontend`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot updates. |
| `npm run lint` | Check JavaScript and JSX with ESLint. |
| `npm test` | Run utility, API, rendered gallery, and bid-form interaction tests. |
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
- Frames follow each image's proportions, with recessed mats and subtle glass
  highlights. Images stay uncropped; no WebGL is required.
- On screens wider than 760px, the artwork has a large display area with
  compact title and bid labels to its right. At 760px and below, the labels sit
  beneath the frame; short landscape windows keep them beside it.
- Guide labels show the work's title, collection number, bid amount, and lock
  status in the site's olive, parchment, and brass palette.
- A compact 28px information bubble on each frame retains a 44px touch target
  and opens a native modal dialog containing
  collection notes, artwork details, framing, starting price and collection/postage
  information. Escape, the close button or clicking the dialog backdrop dismisses it.
- The information dialog uses a compact header and two-column fact layout to fit
  its current notes in one view, with extra compact layouts for phones and short
  landscape screens. Scrolling remains available for larger text or longer notes.
- A skip link, inactive slides excluded from focus, native modal focus handling
  and reduced-motion support. Reduced motion disables smooth navigation.
- A footer disclosure that the pieces are copies, imitations or studies of
  AI-modified, AI-generated or inspired artwork, rather than originals by the
  referenced artists.

The bid form collects amount, name, and email, then sends an email code.
The bidder must verify the address before the database accepts a bid.
Requesting a code does not reserve an artwork. Supabase stores a persistent
Auth identity, but bidders do not choose a password. Tokens stay in memory.
The database replaces each artwork's current leader atomically, enforces the
$75 lock, and never returns contacts to public users.
The `#owner` page requires an allowlisted Supabase Auth account. Winner email
processing runs in Supabase; payment is an external donation confirmed manually.

## Source guide

| File or folder | Responsibility |
| --- | --- |
| `src/main.jsx` | Mount the React application. |
| `src/App.jsx` | Header, collection switch, exhibition count, gallery and footer. |
| `src/components/gallery/GalleryWall.jsx` | Scrolling, active slide, navigation and selected dialog. |
| `src/components/gallery/ArtworkDisplay.jsx` | Centered frame and guide-plaque layout. |
| `src/components/gallery/ArtworkFrame.jsx` | Artwork image, digital frame and information button. |
| `src/components/gallery/ArtworkInfoDialog.jsx` | Modal artwork details. |
| `src/components/bidding/BidPlaque.jsx` | Display bid amounts and secured artwork status. |
| `src/components/bidding/BidDialog.jsx` | Request and verify email codes, then place a bid. |
| `src/data/artworks.js` | Two collections, planned counts, artwork/image mapping and legacy exports. |
| `src/utils/formatters.js` | Shared AUD price and artwork-number formatting. |
| `src/utils/galleryNavigation.js` | Shared bounds for requested and scrolled slide indices. |
| `src/utils/animateGalleryScroll.js` | Cancelable 800ms painting transitions with gentle easing. |
| `src/assets/` | Numbered artwork JPGs imported by Vite. |
| `src/styles/` | Global styles and gallery presentation. |
| `tests/` | Node tests for utilities, artwork contracts and rendered gallery behavior. |

Empty auth, fundraising, navigation and bid-form scaffolds have been removed.
The pages, hooks and services directories contain owner access and auction code.
The public starter SVGs remain available to preserve their existing URLs.

## Update the collections

Edit `collectionDefinitions` in `src/data/artworks.js`. Both collections use
the same object structure: collection metadata, a `defaults` object for shared
details, and an `artworks` array of objects. Each artwork keeps its `image`,
`title`, `description`, `medium`, `priceCents` and optional `alt` together.
Artwork fields override collection defaults. Amounts are stored in cents:
`1000` means AUD $10 and is required for every starting price. Live bid amounts
preserve exact cents. Run `npm run sync:auction` after changing gallery listings,
then apply the generated `supabase/artworks.sql` without replaying migrations.

The first collection lists images `1.jpg` through `10.jpg`. The existing
`artworks` export remains available as an alias of the first collection's
resolved artwork list. The `collections` export resolves image URLs and adds
collection labels and display numbers for the gallery.

The second collection uses `src/assets/11.jpg` through `src/assets/20.jpg`,
including only images that exist. `11.jpg` is its work 01. Add `12.jpg` through
`20.jpg` as they become available; they appear automatically in numbered order
without showing empty slides. Keep each artwork's `priceCents` at `1000`. Run `npm run sync:auction` when adding
new photos, then apply `supabase/artworks.sql`.

Replace the numbered files to change the photos. If you change file types,
update the `.jpg` glob and each object's `image` filename. Set each collection's
`plannedWorkCount` if its planned size changes. The exhibition note uses
available and planned counts; gallery controls use the selected collection's
available artwork count.

Future second-collection works retain placeholder titles, descriptions and
the $10 starting price. Update their titles and descriptions as details become available.
All pieces are unframed works on paper; the frame is a digital presentation.
Frontend data and bundled images are public, so keep private records and secrets
out of these files.

## Validation and compatibility

The Node test runner uses the existing Vite and React dependencies to check
currency rounding, number formatting, carousel bounds, both collections' image
records, the collection-switch control, one-image navigation bounds, initial
gallery accessibility, dialog content and unconfirmed prices. The jsdom
development dependency mounts the actual bid dialog to check verification,
competing $75 locks, changed emails, and retries after an uncertain response.
API tests use synthetic endpoints and never send real codes or bids.
The legacy `formatPrice` export from `src/data/artworks.js` remains available;
the implementation now lives in `src/utils/formatters.js`.

This is a JavaScript project with no configured TypeScript checker. Production
build and ESLint validate source syntax and imports. Server rendering does not
exercise collection switching, browser-only scrolling, resize observation or
native modal focus and dismissal; those still need an interactive browser check.

## Project documentation

- [Project structure](../README.md)
