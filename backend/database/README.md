# Database source

The canonical migration is
[`supabase/migrations/202610260001_auction.sql`](../../supabase/migrations/202610260001_auction.sql).
Follow [SUPABASE_SETUP.md](../../SUPABASE_SETUP.md) to apply it.

Contact records live in `auction_private`. Public access uses functions with
fixed responses rather than table grants. Each artwork has at most one current
highest-bid record; a higher bid replaces the amount, name and email.
