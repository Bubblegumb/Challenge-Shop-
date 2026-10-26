# Connect the verified artwork auction

Each artwork starts at AUD $10 and accepts bids up to AUD $75. The first
accepted, verified $75 bid locks that artwork. Other artworks stay open until
12 noon on 28 October 2026, Australia/Sydney (`2026-10-28T01:00:00Z`).
Requesting a code does not reserve an artwork. The database checks the current
price, lock, and deadline when the verified bid arrives. Email verification
proves access to a mailbox, not the bidder's identity or payment.

## 1. Apply the database migrations

For an existing auction, pause bids in the Supabase SQL Editor before upgrading:

```sql
	update auction_private.settings set accepting_bids = false where id;
```

- For an existing database with migration `202610260001_auction.sql`, run only
  [202610260002_verified_capped_bids.sql](migrations/202610260002_verified_capped_bids.sql).
- For a fresh database, run [202610260001_auction.sql](migrations/202610260001_auction.sql)
  first, then run `202610260002_verified_capped_bids.sql`.

Never rerun migration `001` after upgrading. It restores the old anonymous bid
permission and old bid function. Use [artworks.sql](artworks.sql) for later
artwork listing changes.

The upgrade refuses existing bids above $75 and preserves those records.
Review those bids before retrying. Existing bids of exactly $75 lock their
artwork, including legacy bids accepted before email verification was required.

Run `select public.auction_snapshot();`. Expect `bid_cap_cents: 7500`, a `locked`
flag on each lot, and `accepting_bids: false` while setup is incomplete.
Keep `auction_private` out of Supabase's exposed schemas. Do not grant public
table access. Its tables contain private bidder data and have RLS enabled.

## 2. Enable email verification in hosted Supabase

Local [config.toml](config.toml) does not configure an existing hosted project.
Apply these settings in the hosted project's Authentication settings:

1. Enable the Email provider and allow new users to sign up.
2. Turn **Confirm email** on. An automatically confirmed email would defeat
   the database's verification check.
3. Require confirmation at both addresses for an email address change.
4. Set the email OTP length to **6 digits**, expiration to **600 seconds**,
   and the minimum interval between emails to **60 seconds**.
5. Copy [templates/bid-code.html](templates/bid-code.html) into both the
   **Confirm signup** and **Magic link** email templates. Keep `{{ .Token }}`
   in both templates so new and returning bidders receive a code.

Supabase creates a persistent Auth identity for each bidder's email. Bidders
enter a code without choosing a password. The website keeps the verified
session token in memory and does not save it in browser storage.

Configure **custom SMTP in Supabase Authentication** before accepting public
bids. The default Supabase sender restricts delivery to project team members.
The winner worker's Edge Function secrets do not configure Auth email delivery.

For Gmail, use sender and username `sujaljoshi77@gmail.com`, host
`smtp.gmail.com`, port `465`, and TLS. Enable Google 2-Step Verification, then
create a Gmail App Password. Enter that password in the hosted Auth SMTP
settings. Keep it out of frontend variables, source files, and chat.

## 3. Connect the website

Set `fontend/.env.local` using the project's publishable key:

```dotenv
	VITE_SUPABASE_URL=https://nfiillxbnvkbwciknjll.supabase.co
	VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Restart Vite after saving. Add the same two variables in Vercel and redeploy.
Use root directory `fontend`, build command `npm run build`, and output `dist`.
Never put a Supabase secret key, database password, or Gmail password in a
`VITE_` variable. Browser bundles expose those variables.

## 4. Create the owner account

Create or select your user in Supabase **Authentication > Users**. Give the
owner a strong password and confirm the owner's email. Copy its UUID into:

```sql
	insert into auction_private.owners(user_id)
	values ('REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid)
	on conflict do nothing;
```

Sign in at `https://challenge-shop-eight.vercel.app/#owner`, or add `#owner`
to the local Vite URL. Only allowlisted owners can see bidder contacts or mark
donations as received. Reloading the page requires another owner sign-in.
Verify the actual donation before handing over an artwork.

## 5. Configure the winner email worker

Winner emails still send at the auction deadline, including for artworks
locked at $75 earlier. They use the existing Gmail SMTP worker.

In Supabase **Edge Functions > Secrets**, set these values:

- `GMAIL_APP_PASSWORD`: the Gmail App Password for `sujaljoshi77@gmail.com`.
- `AUCTION_CRON_SECRET`: a cryptographically random secret of at least 32 characters.
- `AUCTION_SUPABASE_SECRET_KEY`: the project's Supabase secret key.

The worker can fall back to `SUPABASE_SERVICE_ROLE_KEY` if the custom key is
absent. Keep these secrets in Supabase. To generate a scheduler secret locally:

```powershell
	node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

From the repository root, deploy the worker:

```powershell
	npx supabase login
	npx supabase functions deploy winner-mail --project-ref nfiillxbnvkbwciknjll
```

The function disables gateway JWT verification and checks the private
`x-auction-secret` header itself. Never send that header from the public website.

## 6. Schedule finalization and winner emails

1. Enable `pg_cron` and `pg_net` in Supabase.
2. Add a Vault secret named `auction_cron_secret` with the same value as
   `AUCTION_CRON_SECRET`.
3. Apply [schedule.sql](schedule.sql). Its function URL targets the production
   project. Use the test project's URL when rehearsing in a test project.
4. Check both Cron jobs and the worker logs for errors.

The jobs run every minute and catch up after downtime. The database rejects
bids at the exact deadline even when a job runs late. Each worker invocation
processes up to five winner emails.

Explicit SMTP refusals retry after five minutes, up to ten attempts. Interrupted
or uncertain sends become `needs_review`. Check Gmail Sent before retrying.
The `accepted` status means Gmail accepted a message, not that it reached an inbox.
After confirming a message was not sent, reset only that job:

```sql
	update auction_private.email_jobs
	set status = 'pending', attempts = 0, available_at = clock_timestamp(),
	    claim_token = null, claimed_at = null, last_error = null
	where artwork_id = 'REPLACE_WITH_ARTWORK_ID' and status = 'needs_review';
```

## 7. Rehearse and open bidding

Use a separate test Supabase project and emails you control. Test new and
returning bidder codes, invalid codes, expired codes, and a competing $75 bid.
Check that the first accepted $75 bid wins, later bids fail, and other lots
remain open. Confirm that requesting a code never reserves a lot.

Test owner access, donation confirmation, deadline finalization, and actual
winner email delivery. Do not create test bids or shorten the deadline in
production. Also check the bid form on a phone.

Once the database, Auth SMTP, templates, website, and worker are ready, run:

```sql
	update auction_private.settings set accepting_bids = true where id;
```

The gallery refreshes within 15 seconds. Set the flag to `false` to pause.
The fixed deadline and $75 locks still apply.

## 8. Update artworks and collection details

After changing gallery titles or photos, run `npm.cmd run sync:auction` in
`fontend`. Apply the generated [artworks.sql](artworks.sql) in SQL Editor.
Run `npm.cmd run check:auction` to check that file against the gallery.
Do not replay migrations to update listings.

Before winner emails are prepared, update `auction_private.settings.collection_note`
with the confirmed State Library date, meeting point, and one-hour collection
window. Prepared email payloads retain their original instructions. Send a
separate update if those details change after preparation.

See [backend verification](../backend/README.md) for local checks and their limits.
Official references: [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys), and
[scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).
