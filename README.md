# Volea · Real-time Court Booking

> **Work in progress.**

A booking app for a fictional padel club. Players pick a court and a day, see the free time slots and book one. When someone books, the slot turns busy on everyone else's screen at once, without reloading the page. Admins see and manage all bookings.

## Tech stack

- **API:** Node.js, Express 5 and TypeScript
- **Security:** helmet and CORS
- **Validation:** Zod
- **Tests:** Vitest and Supertest
- **Web:** Next.js *(coming soon)*

## Project structure

```
agenda-reservas/
├── api/     ← REST API (Express)
└── web/     ← frontend (Next.js, coming soon)
```

## Run it locally

You need Node.js 24 (see `.nvmrc`).

```bash
cd api
cp .env.example .env
npm install
npm run dev
```

The API runs on [http://localhost:4000](http://localhost:4000). Check it with [`/api/salud`](http://localhost:4000/api/salud).

## Scripts (inside `api/`)

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and restarts it on every change |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm start` | Runs the compiled API |
| `npm run lint` | Checks the code with ESLint |
| `npm run typecheck` | Checks the TypeScript types |
| `npm test` | Runs the tests |

## License

[MIT](LICENSE)
