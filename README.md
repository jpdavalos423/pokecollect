# PokéCollect

PokéCollect is a web app to search, collect, filter, and organize Pokémon cards in a binder.

Current architecture:
- Frontend: HTML/CSS/JS (ES modules + web components)
- Backend: Node.js + Express API
- Database: Postgres
- Auth: JWT bearer tokens
- Card Data Provider: TCGdex (`https://tcgdex.dev/`)

## Setup
1. Install dependencies:
   - `npm install`
2. Create env file:
   - `cp .env.example .env`
3. Update `.env`:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - Optional: `TCGDEX_API_BASE_URL`, `POKEMON_CACHE_TTL_MS`

## Run
1. Start API server:
   - `npm run start:api`
2. Start frontend dev server:
   - `npm run start:dev`
3. Open app:
   - [http://localhost:5500](http://localhost:5500)

By default, frontend calls backend at `http://localhost:3001/api/v1`.

## Notes
- Offline mode has been removed from runtime flows.
- Legacy `localStorage` is no longer the primary data source.
- Collection and binder writes now go through backend APIs.
- Card image fallback is a generic Pokémon card back: `assets/images/card-back.png`.
