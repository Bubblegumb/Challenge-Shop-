# Database changes

Reserve `migrations/` for ordered SQL migrations once the backend is chosen.
Use descriptive filenames such as `202610170001_create_artworks.sql`. Include
constraints, indexes and access policies with related schema changes.

Section 6 of [the learning guide](../WEBSITE_LEARNING_GUIDE.md) describes the
planned artworks, bids, orders and donation_ledger tables. No tables or migrations
are implemented. Verify future migrations in staging before production. Move
this directory if the selected platform requires its own migrations path.
