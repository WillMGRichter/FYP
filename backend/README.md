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

After account features are added to an existing database, run:

```sh
pnpm --filter backend exec prisma migrate dev --name add_accounts_and_starred_repos
```

5. Start the backend:

```sh
pnpm --filter backend run dev
```

## Commands

`GET /api/health`

Checks the service is running.

`POST /api/auth/register`

Creates an account and returns a session token.

```json
{
  "email": "researcher@example.com",
  "displayName": "Researcher",
  "password": "8-or-more-characters"
}
```

`POST /api/auth/login`

Signs in and returns a session token.

```json
{
  "email": "researcher@example.com",
  "password": "8-or-more-characters"
}
```

`GET /api/auth/me`

Returns the current account when an `Authorization: Bearer <session-token>` header is supplied.

`POST /api/auth/logout`

Deletes the current backend session.

`POST /api/github/tokens`

Validates a user GitHub token with GitHub `/user`, stores it encrypted against the signed-in account, and records rate-limit metadata.

```json
{
  "label": "Research token",
  "token": "github_pat_..."
}
```

`GET /api/github/tokens`

Lists saved token metadata for the signed-in account. Raw tokens are never returned.

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

`POST /api/repositories/:id/star`

Stars a synced repository for the signed-in account.

`DELETE /api/repositories/:id/star`

Removes the signed-in account's star from a repository.

`GET /api/account/contributions`

Lists contribution summaries observed during syncs for the signed-in account's saved GitHub login.

`POST /api/extension/snapshots`

Accepts browser-extension captured payloads and stores them as `browser_extension` snapshots attached to a previously synced repository.
