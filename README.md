# NedsShop application structure

NedsShop currently runs as a React and Vite gallery in `fontend/` (the existing
directory spelling is retained). It displays ten artwork studies, starting
prices in AUD and a modal information guide. Login, bid submission, payments
and backend requests are planned; they are not implemented.

See the [frontend guide](fontend/README.md) for current behavior and collection
editing, and the [backend plan](backend/README.md) for future server work.
The local [learning guide](WEBSITE_LEARNING_GUIDE.md),
[feature roadmap](FEATURE_ROADMAP.md) and
[feature completion guide](FEATURE_COMPLETION_GUIDE.md) describe future work.

```text
NedsShop/
|-- fontend/                       React + Vite gallery
|   |-- public/                    Files served unchanged at public URLs
|   |-- src/
|   |   |-- main.jsx               React entry point
|   |   |-- App.jsx                Header, exhibition note, gallery and footer
|   |   |-- assets/                Numbered artwork JPGs imported by Vite
|   |   |-- components/
|   |   |   |-- gallery/           GalleryWall, ArtworkDisplay, ArtworkFrame,
|   |   |   |                      ArtworkInfoDialog
|   |   |   |-- bidding/           Starting-price display: BidPlaque
|   |   |-- data/                  Public practice artwork records
|   |   |-- hooks/                 Reserved for reusable state/effects
|   |   |-- pages/                 Reserved for future screens
|   |   |-- services/              Reserved for future backend requests
|   |   |-- utils/                 Shared formatting and carousel bounds
|   |   |-- styles/                App.css and global index.css
|   |-- tests/                     Utility and rendered-gallery regression tests
|   |-- package.json
|   |-- package-lock.json
|   |-- vite.config.js
|-- backend/                       Future server package; no runtime yet
|   |-- database/
|   |   |-- README.md              Database implementation guidance
|   |   |-- migrations/            Reserved for schema and access policies
|   |-- tests/                     Reserved for future backend tests
|   |-- README.md                  Planned server responsibilities
|   |-- package.json               No dependencies or run scripts yet
|   |-- package-lock.json
|-- decisions/                     Implementation decisions and references
```

Empty frontend directories use `.gitkeep` files until they contain real code.
Unimplemented component files and comment-only backend files have been removed;
their planned responsibilities remain documented instead of appearing as
working modules.

## Run locally

From the project root in PowerShell:

```powershell
Set-Location fontend
npm ci
npm run dev
```

No backend or environment variables are required for the current gallery.
Run `npm test`, `npm run lint` and `npm run build` from `fontend` to check changes.
Use `npm run preview` to inspect the production build.

## Where to add code

- Compose the current screen in `src/App.jsx`. Add separate screens to `pages`
  when needed; routing has not been installed.
- Keep gallery components in `components/gallery` and bidding components in
  `components/bidding`. Add authentication and other feature folders when
  implementation begins.
- Keep gallery presentation and global rules in `src/styles`.
- Store imported artwork images in `src/assets` and public demo listings in
  `src/data`. Files in `public` are served unchanged. Both image locations are
  publicly accessible after deployment.
- Put shared formatting helpers in `utils`, reusable state/effects in `hooks`
  and future browser API requests in `services` as concrete needs arise.
- Implement server responsibilities described in `backend/README.md` before
  accepting real bids. The server must decide identity, bid acceptance,
  deadlines, winners and payment amounts.
- Keep secrets, buyer records and private permission evidence out of frontend
  source and public assets. Database changes and policies belong in
  `backend/database/migrations`.

The learning guide's `src/App.css` and `src/index.css` live in `src/styles/`.
Continue using the guide's `fontend` working directory and `src/App.jsx`
exercises, treating planned features as implementation guidance.
