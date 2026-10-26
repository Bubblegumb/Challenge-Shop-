# Auction backend verification

The auction runs in Supabase rather than a separate Node HTTP server. The
canonical migration is `../supabase/migrations/202610260001_auction.sql`.
The Gmail worker is in `../supabase/functions/winner-mail/`.

Follow [SUPABASE_SETUP.md](../SUPABASE_SETUP.md) to configure the approved project,
owner account, Gmail, and scheduled winner emails.

Run `npm.cmd ci`, then `npm.cmd test` in this directory. Tests execute the actual
migration in PGlite (PostgreSQL compiled to WASM), with test Supabase roles and
`auth.uid()`. They verify contact replacement, private access, deadline checks,
finalization, email job recovery, and winner email content. PGlite uses one
connection; a multi-session test Supabase rehearsal and real Gmail delivery test
remain production checks.

The website calls `auction_snapshot()` and `submit_bid(...)`. The database owns
prices, atomic contact replacement, row locks, and the cutoff. Owner functions
check `auth.uid()` against the allowlist. Only the service role can finalize
auctions and process email jobs.

The design review selected managed SQL and serverless processing over a hosted
Node and SQLite service to fit the Vercel frontend. Restart catch-up was kept.
Bid history was replaced with one overwritten leader following the user's
instruction.

Run `npm.cmd run check:auction` in `fontend` to verify that the migration seeds
match the gallery. Future event rescheduling requires updating both database
settings and `fontend/src/utils/bidding.js`.
