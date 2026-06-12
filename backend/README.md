# GitHub Research Backend

Fastify API for collecting GitHub repository data into the Prisma/Postgres snapshot schema.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to your Postgres database.
3. Set `GITHUB_TOKEN_SECRET` to a long random string before saving tokens.
4. Generate and apply the database structure:

```sh
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate dev --name init_github_research_schema
```

5. Start the backend:

```sh
pnpm --filter backend run dev
```

## Commands

`GET /api/health`

Checks the service is running.

`POST /api/github/tokens`

Validates a user GitHub token with GitHub `/user`, stores it encrypted, and records rate-limit metadata.

```json
{
  "label": "Research token",
  "token": "github_pat_..."
}
```

`GET /api/github/tokens`

Lists saved token metadata. Raw tokens are never returned.

`POST /api/repositories/sync`

Collects repository metadata plus the latest issues, pull requests, and commits from the GitHub REST API. Each payload is stored as a snapshot.

```json
{
  "owner": "facebook",
  "name": "react",
  "tokenId": "optional-saved-token-id"
}
```

`GET /api/repositories`

Lists stored repositories with artifact, snapshot, and collection-run counts.

`GET /api/collections`

Lists recent collection runs.

`POST /api/extension/snapshots`

Accepts browser-extension captured payloads and stores them as `browser_extension` snapshots attached to a previously synced repository.
