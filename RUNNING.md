# Running the Frontend and Backend

This project is a pnpm workspace with three packages:

| Directory  | What it is                                  | Default port |
| ---------- | ------------------------------------------- | ------------ |
| `backend/` | Fastify + Prisma REST API (TypeScript/tsx)  | `3000`       |
| `web/`     | React + Vite web frontend                   | `5173`       |
| `extension/`| Chrome extension (optional, not required)   | `5173` (dev) |

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [pnpm](https://pnpm.io/) `>= 10` (the backend pins `pnpm@10.33.2`)
- A PostgreSQL database (e.g. a local Postgres or a Supabase instance)

## 1. Install dependencies

From the repo root:

```sh
pnpm install
```

This installs dependencies for `backend`, `web`, and `extension` at once.

## 2. Backend setup

### 2.1 Configure environment variables

Create `backend/.env` from the example:

```sh
cp backend/.env.example backend/.env
```

`backend/.env` needs at minimum:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fyp"
GITHUB_TOKEN_SECRET="replace-with-a-long-random-secret"
PORT=3000
HOST=0.0.0.0
```

- `DATABASE_URL` — connection string to your PostgreSQL database.
- `GITHUB_TOKEN_SECRET` — secret used to encrypt stored GitHub tokens (set a long random value in production).
- `PORT` / `HOST` — where the API listens (defaults `3000` / `0.0.0.0`).

### 2.2 Prepare the database

From the `backend/` directory, generate the Prisma client and apply the schema/migrations to the database:

```sh
cd backend
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

- `prisma generate` produces the client at `backend/src/generated/prisma/`.
- `prisma migrate deploy` applies existing migrations. For a fresh/non-migration setup you can use `pnpm exec prisma db push` instead.

## 3. Run the backend

From the `backend/` directory:

```sh
cd backend
pnpm run dev
```

This starts the API with `tsx src/index.ts`. When it is up you should see:

- `GET http://localhost:3000/` → `{ "message": "Backend running" }`
- `GET http://localhost:3000/api/health` → `{ "ok": true, ... }`

## 4. Run the frontend

From the `web/` directory:

```sh
cd web
pnpm run dev
```

The Vite dev server starts on `http://localhost:5173`. The web app calls the backend at `http://localhost:3000/api` by default. To point it at a different API, set `VITE_API_URL` (e.g. create `web/.env` with `VITE_API_URL=http://localhost:3000/api`).

## 5. Common tasks

- **Build the frontend:** `cd web && pnpm run build`
- **Lint the frontend:** `cd web && pnpm run lint`
- **Run the extension:** `cd extension && pnpm run dev` (load the built `dist/` as an unpacked extension in Chrome; see `EXTENSION_QUICK_START.md`)

## 6. Quick checklist

1. `pnpm install` (repo root)
2. `backend/.env` exists with a valid `DATABASE_URL`
3. `cd backend && pnpm exec prisma generate && pnpm exec prisma migrate deploy`
4. `cd backend && pnpm run dev` → API on port `3000`
5. `cd web && pnpm run dev` → frontend on port `5173`
