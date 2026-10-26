# NedsShop application structure

NedsShop is a React/Vite gallery in `fontend/` with guest artwork bidding
backed by Supabase. Every artwork starts at AUD $10. Bids close at noon on
28 October 2026, Sydney time. Higher bids replace each artwork's one current
bidder record. Contact details are private to the owner.

Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) to apply the database SQL, connect
the website, create the owner account and configure scheduled Gmail winner
emails. Production bidding stays disabled until setup is complete. No live
Supabase database changes or deployment have been performed.

See the [frontend guide](fontend/README.md) for gallery editing and commands,
and [backend verification](backend/README.md) for database and mail tests.

```text
NedsShop/
|-- fontend/                  React gallery, guest bids and owner page
|   |-- src/components/       Gallery, artwork information and bid form
|   |-- src/data/artworks.js  Public artwork metadata and $10 starting prices
|   |-- src/hooks/            Auction refresh state
|   |-- src/services/         Supabase API requests
|   |-- src/pages/            Private owner sign-in and results
|   |-- tests/                Utility and rendered-component checks
|-- supabase/
|   |-- migrations/           Database schema, access rules and artwork seed
|   |-- functions/            Scheduled Gmail winner-email worker
|   |-- schedule.sql          Supabase Cron jobs
|-- backend/tests/            PostgreSQL and email-worker verification
|-- SUPABASE_SETUP.md         Database, credentials and deployment steps
```

## Run locally

From the project root in PowerShell:

```powershell
Set-Location fontend
npm ci
npm run dev
```

The gallery can preview without configuration. Live bidding requires the
Supabase variables and setup described in SUPABASE_SETUP.md.
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
- Use the Supabase functions for bid acceptance, deadlines and winners.
  Follow `SUPABASE_SETUP.md` before enabling real bids.
- Keep secrets, buyer records and private permission evidence out of frontend
  source and public assets. Database changes and policies belong in
  `supabase/migrations`.

The learning guide's `src/App.css` and `src/index.css` live in `src/styles/`.
Continue using the guide's `fontend` working directory and `src/App.jsx`
exercises, treating planned features as implementation guidance.
