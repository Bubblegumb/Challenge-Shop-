# NedsShop backend plan

This package reserves space for a future artwork-auction backend. No server,
routes, authentication, payments, database migrations or tests are implemented.
The package has no dependencies or run scripts. The current frontend gallery
runs independently of this package.

Comment-only source placeholders have been removed. Add executable modules and
their tests when implementing the responsibilities below.

```text
backend/
|-- database/
|   |-- README.md                 Database implementation guidance
|   |-- migrations/               Reserved for ordered schema changes
|-- tests/                        Reserved for future backend tests
|-- .env.example                  Safe configuration template
|-- .gitignore                    Includes local .env files
|-- package.json                  Future server package metadata
|-- package-lock.json             Dependency-free npm lockfile
```

## Planned responsibilities

Start with application setup, HTTP startup, configuration validation and a
health endpoint. Install the selected server framework and add run scripts
when there is executable server code.

Organize feature modules around artworks, authentication, bids and orders.
Routes should map URLs to handlers; controllers should validate HTTP input and
shape responses; services should own server operations and database access.
Create these files as each feature is implemented and tested.

Shared middleware should verify sessions, derive authenticated identity,
require a server-controlled admin role and return consistent errors without
exposing private data. A server-only database client should centralize database
connections. Auction finalisation should run transactionally and create at most
one order per artwork.

Real bid checks and updates must run atomically in a database transaction.
Keep secrets on the server, outside frontend code and `VITE_` variables.
Database schema changes, constraints, indexes and access policies belong in
`backend/database/migrations` from the repository root, or `database/migrations`
from this directory.

Follow sections 6-9 of [the learning guide](../WEBSITE_LEARNING_GUIDE.md).
After the initial server setup, add public listings, database access, verified
sessions, bidding and orders in stages, with tests for each implemented feature.
