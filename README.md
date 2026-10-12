# Volea · Real-time Court Booking

> **Work in progress.**

A booking app for a fictional padel club. Players pick a court and a day, see the free time slots and book one. When someone books, the slot turns busy on everyone else's screen at once, without reloading the page. Admins see and manage all bookings.

## Tech stack

- **API:** Node.js, Express 5 and TypeScript
- **Database:** PostgreSQL with Prisma ORM (migrations and seed data)
- **Auth:** JWT in an httpOnly cookie, passwords hashed with bcrypt
- **Security:** helmet, CORS and rate limiting on login
- **Validation:** Zod
- **Tests:** Vitest and Supertest
- **Tooling:** Docker Compose for the local database, GitHub Actions for CI
- **Web:** Next.js *(coming soon)*

## Project structure

```
agenda-reservas/
├── api/                  ← REST API (Express + Prisma)
│   ├── prisma/           ← database schema, migrations and seed data
│   ├── src/
│   └── tests/
├── web/                  ← frontend (Next.js, coming soon)
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
```

The API runs on [http://localhost:4000](http://localhost:4000). Check it with [`/api/salud`](http://localhost:4000/api/salud).

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

Errors always come back as JSON, for example `{ "error": "Email o contraseña incorrectos" }`. Validation errors (400) also include `detalles`, with the problems for each field.

## Scripts (inside `api/`)

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

## License

[MIT](LICENSE)
