# Volea · Real-time Court Booking

> **Work in progress.**

A booking app for a fictional padel club. Players pick a court and a day, see the free time slots and book one. When someone books, the slot turns busy on everyone else's screen at once, without reloading the page. Admins see and manage all bookings.

## Tech stack

- **API:** Node.js, Express 5 and TypeScript
- **Database:** PostgreSQL with Prisma ORM (migrations and seed data)
- **Auth:** JWT in an httpOnly cookie, passwords hashed with bcrypt
- **Security:** helmet, CORS and rate limiting on login
- **Validation:** Zod
- **Dates and time zones:** Luxon
- **Web:** Next.js 16 (App Router), React 19, Tailwind CSS 4 and TanStack Query
- **Tests:** Vitest, Supertest and Testing Library
- **Tooling:** Docker Compose for the local database, GitHub Actions for CI

## Project structure

```
agenda-reservas/
├── api/                  ← REST API (Express + Prisma)
│   ├── prisma/           ← database schema, migrations and seed data
│   ├── src/
│   └── tests/
├── web/                  ← frontend (Next.js)
│   ├── app/              ← pages: login, registro, reservar, mis-reservas, admin
│   ├── components/
│   ├── lib/              ← API client, data hooks and date helpers
│   └── tests/
└── docker-compose.yml    ← local PostgreSQL
```

## Run it locally

You need Node.js 24 (see `.nvmrc`) and Docker.

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Set up the API
cd api
cp .env.example .env   # then set JWT_SECRET to a long random value
npm install
npm run db:migrar    # creates the tables
npm run db:seed      # adds demo users and courts

# 3. Start the API
npm run dev

# 4. In another terminal, start the web app
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and use the **Jugador demo** (player) or **Admin demo** buttons (the UI is in Spanish). The API runs on [http://localhost:4000](http://localhost:4000).

The web app forwards every `/api/...` request to the API (Next.js rewrites). To the browser, the API lives on the same site as the page, so the session cookie is first-party and there is no CORS to deal with. Set `API_URL` in `web/.env.local` if the API runs somewhere else.

### Demo users

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `demo1234` |
| Player | `cliente@example.com` | `demo1234` |

## API endpoints

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/api/salud` | public | Health check |
| POST | `/api/auth/registro` | public | Creates a player account and signs in |
| POST | `/api/auth/login` | public | Signs in (sets the session cookie) |
| POST | `/api/auth/logout` | public | Signs out (clears the session cookie) |
| GET | `/api/auth/yo` | signed in | Returns the current user |
| GET | `/api/recursos` | signed in | Lists the courts |
| GET | `/api/recursos/:id/disponibilidad?fecha=YYYY-MM-DD` | signed in | Time slots of a day: free, taken, mine or past |
| POST | `/api/reservas` | player | Books a slot (`201`, or `409` if it is already taken) |
| GET | `/api/reservas/mias` | player | My upcoming bookings |
| DELETE | `/api/reservas/:id` | owner or admin | Cancels a booking |
| GET | `/api/admin/reservas?fecha=YYYY-MM-DD` | admin | All bookings of a day, any date |
| GET | `/api/admin/recursos` | admin | All courts, including inactive ones |
| POST | `/api/admin/recursos` | admin | Creates a court |
| PATCH | `/api/admin/recursos/:id` | admin | Renames a court or turns it on/off |

Without a session the API answers `401`; with a session but the wrong role, `403`. Courts are never deleted, only turned off, so the booking history stays complete.

Errors always come back as JSON, for example `{ "error": "Email o contraseña incorrectos" }`. Validation errors (400) also include `detalles`, with the problems for each field.

## Booking rules

- Slots last 1 hour and start on the hour, from 08:00 to 22:00 (club time, `America/Santiago`).
- You can book from today up to 6 days ahead, but never in the past.
- A court can't be booked twice for the same slot. If two people try at the same moment, only one gets it and the other gets a `409`.
- Each player can have at most 2 active bookings.
- Only the owner or an admin can cancel a booking, and only before it starts. Cancelling keeps the record and frees the slot.

## Scripts

Inside `api/`:

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and restarts it on every change |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm start` | Runs the compiled API |
| `npm run lint` | Checks the code with ESLint |
| `npm run typecheck` | Checks the TypeScript types |
| `npm test` | Runs the tests |
| `npm run db:migrar` | Applies the migrations (and creates new ones after a schema change) |
| `npm run db:seed` | Loads the demo data |
| `npm run db:reiniciar` | Deletes everything and rebuilds the database from scratch |

Inside `web/`: `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm run typecheck` and `npm test` do the same for the web app.

## License

[MIT](LICENSE)
