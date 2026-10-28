# Shrtnr. — ShortLink

A lightweight URL shortener built with Next.js, strict TypeScript, PostgreSQL,
Prisma, and Tailwind CSS.

**Status:** the responsive shortening form, copyable results, database foundation,
link-creation API, and short-code redirects are implemented.
Analytics, QR codes, and public-launch abuse controls are later milestones.

**Live demo:** pending deployment.

## Run locally

Use Node.js **24.x** and npm. PostgreSQL **17** is used in development and CI.
With nvm installed, `nvm install` and `nvm use` select the project runtime.

```bash
npm ci
```

Installation generates Prisma Client. The home page and production build
work without database credentials. To shorten links, create `.env.local`
from `.env.example` if that file does not already exist.

With Docker Engine and Compose available:

```bash
docker compose up -d --wait
docker compose exec postgres createdb -U shortlink shortlink_test
npm run db:deploy
npm run dev
```

Create `shortlink_test` once per new local volume; skip `createdb` if it already
exists. Open <http://localhost:3000>. The local credentials in `.env.example`
match Compose and must not be used for hosted databases.

Compose binds PostgreSQL to localhost:5432 and preserves data in a named volume.
`docker compose down` stops it without deleting that volume. An existing local
PostgreSQL installation also works: create separate development and test databases
and update the connection URLs.

## Shorten and share

Paste a complete HTTP(S) URL into the home-page form and select **Shorten link**.
The result shows a full short URL and its saved destination. Use **Copy link** to
copy it, or **Open link** to visit it in a new tab. Full links use the current
page's origin, so local, preview, and production environments work independently.

The form validates URLs before sending them; the backend independently enforces
the same policy. Pending feedback prevents concurrent submissions. Errors preserve
your input, and editing clears the previous result. Network failures do not retry
the write automatically: a request can succeed even if its response is lost.

Success moves keyboard focus to the result. Errors are announced and invalid
input receives focus. Clipboard copying requires a supported secure browser
context and can be denied; when unavailable, the link is selected for manual
copying. See the [Clipboard API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText).
JavaScript is required for the form. Created links are stored in PostgreSQL;
the interface keeps no browser history or local-storage copy of your URLs.

### Environment variables

| Variable            | Used by                                | Value                                                   |
| ------------------- | -------------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`      | Application queries                    | Application PostgreSQL connection; pooled on Neon       |
| `DIRECT_URL`        | Migration commands                     | Direct connection to the intended database              |
| `TEST_DATABASE_URL` | Integration tests and their migrations | Local PostgreSQL database with a name ending in `_test` |

Never commit actual credentials or expose them through `NEXT_PUBLIC_` variables.
Next.js loads its environment files; Prisma and the integration runner load
`.env.local`, then `.env`, while preserving existing environment variables.

## API

### POST /api/links

Create a link record from one absolute HTTP(S) destination:

```bash
curl -i http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com/article?source=portfolio#details"}'
```

Example `201 Created` response:

```json
{
  "data": {
    "id": "94d1b2e4-61ac-42f1-8b59-c94aad7e819a",
    "code": "Ab12_cd3",
    "destinationUrl": "https://example.com/article?source=portfolio#details",
    "createdAt": "2026-01-01T12:00:00.000Z"
  }
}
```

Only the `url` field is accepted. Leading and trailing whitespace is trimmed;
the destination is normalized through the URL parser. Queries and fragments are
preserved. Raw whitespace, control characters, backslashes, credentials, and
non-HTTP(S) schemes are rejected. Both the trimmed input and normalized URL are limited
to 2,048 characters, and the UTF-8 JSON request body is limited to 8 KiB.

Codes contain eight URL-safe characters generated from 48 cryptographically
random bits. The database unique index handles concurrent collisions, with at
most five insertion attempts. Each valid POST creates an independent record.
The backend stores destinations without fetching them.

Open the returned code as a path on this application, such as
`http://localhost:3000/Ab12_cd3`, to follow its saved destination.

| Status | Meaning                                           |
| ------ | ------------------------------------------------- |
| `201`  | Link created                                      |
| `400`  | Invalid JSON, request shape, or destination       |
| `413`  | Request body exceeds 8 KiB                        |
| `415`  | Content type is not `application/json`            |
| `503`  | Database access or code allocation is unavailable |
| `405`  | Unsupported HTTP method                           |

Errors use this shape:

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "url must be a valid HTTP or HTTPS URL."
  }
}
```

POST responses use `Cache-Control: no-store`. Database details are not returned to
clients or included in application error logs. Request throttling and abuse
controls remain prerequisites for a public anonymous-writing launch.

### GET /:code and HEAD /:code

Resolve an eight-character, case-sensitive short code:

```bash
curl -I http://localhost:3000/Ab12_cd3
```

Replace `Ab12_cd3` with the code returned by your creation request.

A saved link returns `302 Found` with its normalized HTTP(S) destination in
`Location`. The saved query string and fragment are preserved; extra query
parameters on the short URL are ignored. Redirects use `Cache-Control: no-store`
and `Referrer-Policy: no-referrer`. The backend revalidates the stored destination
before using it as a redirect header and does not fetch it.

`HEAD` returns the same status and headers without a body. Invalid or unknown
codes return `404` with error code `LINK_NOT_FOUND`. A failed lookup or unsafe
stored destination returns `503` with `LINK_UNAVAILABLE`, without a redirect or
private exception details. Error responses also use `no-store`. Other methods
receive `405`. Click tracking is not implemented yet.

## Architecture and schema

One Next.js App Router application owns pages and backend routes. The Node.js
route validates input before calling the creation service. That service inserts
through Prisma, retrying only unique-index collisions on the short code.
The redirect service looks up only the destination through the code's unique
index. Malformed codes are rejected before querying PostgreSQL. Dynamic routing
and explicit cache headers ensure each valid visit resolves the current record.

| Link field       | PostgreSQL type          | Behavior                                                        |
| ---------------- | ------------------------ | --------------------------------------------------------------- |
| `id`             | UUID                     | Primary key, generated by Prisma                                |
| `code`           | Varchar(32)              | Unique lookup key; current generated codes are eight characters |
| `destinationUrl` | Text                     | Normalized destination                                          |
| `createdAt`      | Timestamp with time zone | Database creation-time default                                  |

`src/lib/db.ts` is server-only and creates its client lazily. The client is
reused per process, including development hot reloads, with a pool of two
connections and 10-second connection and idle timeouts. Each serverless instance
has its own pool.

```text
src/app/                 Pages, metadata, styles, and API routes
src/components/          Interactive shortening form and result
src/lib/http/            Bounded JSON request handling
src/lib/links/           Validation and collision-safe creation
src/lib/db.ts            Server-only PostgreSQL client
prisma/                  Schema and committed SQL migrations
tests/integration/       PostgreSQL-backed behavior checks
tests/e2e/               Production HTTP and browser checks
.github/workflows/       Application and PostgreSQL CI jobs
```

### Database changes

Apply committed migrations with `npm run db:deploy`; inspect their state with
`npm run db:status`. For local schema development:

```bash
npm run db:format
npm run db:migrate -- --name describe_the_change
npm run db:generate
```

Review generated SQL before committing. `migrate dev` needs a disposable shadow
database and is for local development. If Prisma proposes resetting a database
with data, inspect the drift before proceeding.

Client generation runs during installation, type checking, and production
builds. These commands never apply migrations. Prisma CLI, Client, and the
PostgreSQL adapter are pinned to 7.10.1; use the project's npm scripts.

## Verification

```bash
npm run format:check
npm run lint
npm run db:validate
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:integration
npm run test:e2e:database
```

Both database suites require the dedicated local test database. They apply
committed migrations and verify persistence, rollback, real unique-index
collisions, concurrent creation, redirects, and API responses. They remove only
their own records and never fall back to application or production credentials.

The database browser suite starts the production server with its application
connection explicitly overridden by the guarded test URL. It verifies creation,
redirect headers, browser navigation, referrer suppression, HEAD, deleted links,
and unsafe stored data. It also creates a link through the actual form, verifies
the saved database record, reads the copied URL, and opens the destination.
Destination pages are served by a local test fixture, so no
external website is required. Run `npm run build` before either browser suite.
Stop any development server using port 3000 before running the browser suites.

Playwright starts the production build and checks keyboard navigation, narrow
mobile layouts, form validation, pending feedback, safe server errors, manual-copy
fallback, and API routing. Database-free success/error UI tests explicitly mock
the creation response; the PostgreSQL suite checks the real flow.
On Linux, its browser dependencies may require
`npx playwright install --with-deps chromium`.

CI runs application checks without database URLs and integration tests against
a disposable PostgreSQL 17 service. It uses standard Ubuntu runners, read-only
repository permissions, and no hosted database secrets or uploaded artifacts.
The PostgreSQL job also builds the app and runs the database-backed browser suite.

## Deployment and cost

The project targets a personal, noncommercial deployment on
[Vercel Hobby](https://vercel.com/docs/plans/hobby), a free `.vercel.app` domain,
and [Neon Free](https://neon.com/pricing). No paid API, trial, purchased domain,
or required subscription is used.

Neon Free currently includes 100 CU-hours per month and 1 GB storage per project,
with compute sleeping after five inactive minutes. Vercel Hobby has bounded
compute and transfer allowances; consult its linked plan before deployment.
Standard GitHub-hosted runners are
[free for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Provider plans were rechecked on 2026-10-28. Stay within free allowances rather
than enabling billable upgrades.

Import the GitHub repository into Vercel, select Next.js and Node 24, and use
`npm ci --include=dev` followed by `npm run build`. Set `main` as the production
branch; feature branches and PRs receive previews. A Vercel deployment and GitHub
CI run independently, so check both before merging.

Before deploying database-backed requests, provision isolated production and
preview databases and configure their scoped `DATABASE_URL` values. Preserve
Neon's TLS options. Apply reviewed migrations explicitly using `DIRECT_URL`
for the intended environment; never run production migrations in a normal build
or against a preview's production connection. Keep test credentials local to CI.

Verify the deployed commit, HTTPS page, and API behavior before publishing a live
demo URL. To roll back application code, redeploy a previous verified commit
through Vercel. Application rollback does not undo database migrations; preserve
schema compatibility or use a reviewed forward fix.

## Dependency licenses

Exact versions and transitive package metadata are recorded in
`package-lock.json`. Dependency notices are included with installed packages.

| Dependencies                                                 | License                                    |
| ------------------------------------------------------------ | ------------------------------------------ |
| Node.js, Next.js, React, Tailwind CSS, PostCSS               | MIT, with bundled notices where applicable |
| ESLint, Prettier, Vitest, Testing Library, jsdom             | MIT                                        |
| `pg`, `server-only`, `@types/*`                              | MIT                                        |
| TypeScript, Prisma CLI/Client/PostgreSQL adapter, Playwright | Apache-2.0                                 |
| `dotenv`                                                     | BSD-2-Clause                               |
| PostgreSQL server                                            | PostgreSQL License                         |

Browser distributions and container images retain their own bundled notices.
Hosted services are governed by their service terms and free-tier limits.
ESLint 9 currently matches the installed Next.js lint plugins' peer requirements;
its support warning is recorded for a coordinated tooling upgrade.
