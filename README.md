# NedsShop application structure

NedsShop is a React/Vite gallery in `fontend/` with verified artwork bidding
backed by Supabase. Every artwork starts at AUD $10 and has an AUD $75 cap.
The first accepted, verified $75 bid locks its artwork. Other artworks close
at noon on 28 October 2026, Sydney time. Higher bids replace each artwork's
one current bidder record. Contact details are private to the owner.

Follow the [Supabase setup guide](supabase/README.md) to apply migrations,
configure email verification, connect the website, create the owner account,
and schedule Gmail winner emails. Keep bidding paused until setup is complete.

See the [frontend guide](fontend/README.md) for gallery editing and commands,
and [backend verification](backend/README.md) for database and mail tests.

```text
NedsShop/
|-- fontend/                  React gallery, verified bids and owner page
|   |-- src/components/       Gallery, artwork information and bid form
|   |-- src/data/artworks.js  Public artwork metadata and $10 starting prices
|   |-- src/hooks/            Auction refresh state
|   |-- src/services/         Supabase API requests
|   |-- src/pages/            Private owner sign-in and results
|   |-- tests/                Utility and rendered-component checks
|-- supabase/
|   |-- migrations/           Database schema, access rules and artwork seed
|   |-- functions/            Scheduled Gmail winner-email worker
|   |-- templates/            Bid verification email template
|   |-- artworks.sql          Generated artwork listing updates
|   |-- schedule.sql          Supabase Cron jobs
|   |-- README.md             Database, Auth SMTP and deployment steps
|-- backend/tests/            PostgreSQL and email-worker verification
```

## Run locally

From the project root in PowerShell:

```powershell
Set-Location fontend
npm ci
npm run dev
```

The gallery can preview without configuration. Live bidding requires the
Supabase variables and the setup described in `supabase/README.md`.
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
  Follow `supabase/README.md` before enabling real bids.
- Keep secrets, buyer records and private permission evidence out of frontend
  source and public assets. Database changes and policies belong in
  `supabase/migrations`.

The learning guide's `src/App.css` and `src/index.css` live in `src/styles/`.
Continue using the guide's `fontend` working directory and `src/App.jsx`
exercises, treating planned features as implementation guidance.
