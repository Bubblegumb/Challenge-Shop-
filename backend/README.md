# Auction backend verification

The auction runs in Supabase rather than a separate Node HTTP server. The
ordered migrations are in `../supabase/migrations/`.
The Gmail worker is in `../supabase/functions/winner-mail/`.

Follow the [Supabase setup guide](../supabase/README.md) to configure the approved
project, email verification, the owner account, Gmail, and scheduled winner emails.

Run `npm.cmd ci`, then `npm.cmd test` in this directory. Tests execute the actual
ordered migrations in PGlite (PostgreSQL compiled to WASM), with test Supabase
roles, confirmed Auth email records, and `auth.uid()`. They verify the $75 cap,
the first accepted $75 lock, email ownership checks, anonymous API rejection,
contact replacement, private access, deadlines, finalization, email job recovery,
and winner email content. PGlite uses one
connection; a multi-session test Supabase rehearsal and real Gmail delivery test
remain production checks.

The website calls `auction_snapshot()` and `submit_bid(...)`. The database owns
prices, atomic contact replacement, row locks, and the cutoff. `submit_bid`
requires an authenticated user with a confirmed email matching the bid.
The first accepted $75 bid locks that lot without advancing email delivery.
Owner functions
check `auth.uid()` against the allowlist. Only the service role can finalize
auctions and process email jobs.

The design review selected managed SQL and serverless processing over a hosted
Node and SQLite service to fit the Vercel frontend. Restart catch-up was kept.
Bid history was replaced with one overwritten leader following the user's
instruction.

Run `npm.cmd run check:auction` in `fontend` to verify that `supabase/artworks.sql`
matches the gallery. Run `npm.cmd run sync:auction` to regenerate it, then apply
that file for listing updates. Never rerun migration `001` after the verification
upgrade because it restores anonymous bid access. Future event rescheduling requires updating both database
settings and `fontend/src/utils/bidding.js`.
