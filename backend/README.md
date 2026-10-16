# NedsShop backend scaffold

The JavaScript files contain TODO comments only. No dependencies are installed,
and no server, routes, authentication or payments are implemented. There are no
run scripts yet.

```text
backend/
|-- src/
|   |-- app.js                    Express application setup
|   |-- server.js                 HTTP server startup
|   |-- config/env.js             Environment configuration and validation
|   |-- middleware/               Session, admin and error handling
|   |-- modules/
|   |   |-- artworks/
|   |   |-- auth/
|   |   |-- bids/
|   |   |-- orders/
|   |-- jobs/finaliseAuctions.js  Scheduled auction finalisation
|   |-- lib/database.js           Server-only database client
|-- tests/                        Future backend tests
|-- .env                          Local configuration; ignored by Git
|-- .env.example                  Safe configuration template
|-- .gitignore
|-- package.json
```

Each feature folder contains routes, controller and service files. Routes map
URLs to handlers; controllers handle HTTP input/output; services contain server
operations. Implement and test these as each feature is built. Installing
 dependencies later will generate package-lock.json.

Follow sections 6-9 of [the learning guide](../WEBSITE_LEARNING_GUIDE.md).
Database schema changes and access policies belong in ../database/migrations.
Real bid checks and updates must run atomically in a database transaction.
Keep secrets on the server, outside frontend code and VITE_ variables.

Start implementation with app.js, server.js and a health endpoint. Then add
public listings, database access, verified sessions, bidding and orders in stages.
