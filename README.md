# NedsShop application structure

Follow [the learning guide](WEBSITE_LEARNING_GUIDE.md) and [feature roadmap](FEATURE_ROADMAP.md).

```text
NedsShop/
|-- fontend/                       React + Vite (existing spelling retained)
|   |-- public/                    Files served unchanged, including artwork photos
|   |-- src/
|   |   |-- main.jsx               React entry point
|   |   |-- App.jsx                Compose the application
|   |   |-- assets/                Images imported by components
|   |   |-- components/
|   |   |   |-- layout/            NavigationBar and shared layout
|   |   |   |-- auth/              Login and account controls
|   |   |   |-- fundraising/       FundraisingNotice and disclosures
|   |   |   |-- gallery/           GalleryWall, ArtworkDisplay, ArtworkFrame,
|   |   |   |                      ArtworkInfoButton, ArtworkInfoDialog
|   |   |   |-- bidding/           BidPlaque, BidForm and bid confirmation
|   |   |-- pages/                 Future Home, Artwork, MyBids, FAQ, Admin screens
|   |   |-- hooks/                 Reusable React state/effects when needed
|   |   |-- data/                  Public practice artwork data
|   |   |-- services/              Browser requests to the future backend
|   |   |-- utils/                 Shared money/date formatting
|   |   |-- styles/                App.css and global index.css
|   |-- package.json
|   |-- package-lock.json
|   |-- vite.config.js
|-- backend/                       Reserved for future server code
|-- database/
|   |-- migrations/                Future schema changes and access policies
|-- WEBSITE_LEARNING_GUIDE.md
|-- FEATURE_ROADMAP.md
```

This is a folder scaffold. The Vite starter remains the current screen. Login and
NavigationBar are still empty files; other named components above are planned,
not implemented. `.gitkeep` files preserve empty directories in version control.

## Run locally

From the project root in PowerShell:

```powershell
Set-Location fontend
npm ci
npm run dev
```

Run `npm run lint` and `npm run build` from `fontend` to check changes.
Use `npm run preview` to inspect the production build.

## Where to add code

- Compose the first screen in `App.jsx`. Use `pages` when separate screens are
  needed; routing has not been installed.
- Keep feature components together, following the names in section 3 of the
  learning guide. For example, put `GalleryWall.jsx` and `ArtworkDisplay.jsx` in
  `components/gallery`. The roadmap's suggested `components/ArtworkCard.jsx`
  can instead live in `components/gallery/ArtworkCard.jsx`.
- Keep component-specific CSS beside its component and global rules in `styles`.
- Put your own public practice image at `fontend/public/artwork-01.jpg`, as the
  guide suggests. Imported images belong in `src/assets`; both are publicly
  accessible after deployment.
- Store public demo listings in `data` and demo bids in React state. Shared
  formatting helpers belong in `utils`. Add hooks only when state logic needs
  to be reused.
- Put browser API requests in `services` once the backend exists. The server must
  decide real identity, bid acceptance, deadlines, winners and payment amounts.
- Keep secrets, buyer records and private permission evidence out of frontend
  source and public assets. Database policies belong with migrations.

The guide's `src/App.css` and `src/index.css` now live in `src/styles/`; imports
have been updated. Continue using the guide's `fontend` working directory and
`src/App.jsx` exercises. No dependencies or live services have been added.
