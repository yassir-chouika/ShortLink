# Shrtnr. — ShortLink

A lightweight URL shortener built with Next.js, strict TypeScript, PostgreSQL,
Prisma, and Tailwind CSS.

**Status:** shortening, copyable links, QR downloads, shared creation limits,
operator controls, aggregate redirect analytics, and friendly redirect error
pages are implemented.

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

### Share a QR code

After shortening a link, select **Show QR code**, then **Download QR code (PNG)**.
The preview and 512 × 512 PNG encode the full short URL on the current origin,
not the original destination. Files are named `shrtnr-<code>.png`. The encoder
loads only when requested and runs in your browser: no external QR API, image
upload, new link record, or extra database request is needed.

The code uses black modules, a white four-module quiet zone, and medium error
correction. Keep the white border when printing or placing the image. See the
[QR generator's documentation](https://github.com/soldair/node-qrcode).
If generation fails, you can retry it while continuing to copy or open the link.
Editing the destination clears the result and its QR code.

A QR code still needs a reachable app URL and a working destination. A phone
scanning a `localhost` or `127.0.0.1` link points at the phone itself; use the
verified deployed URL when sharing across devices. Blocking or deleting a saved
link also affects QR codes that lead to it.

### Environment variables

| Variable                | Used by                                | Value                                                                 |
| ----------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`          | Application queries                    | Application PostgreSQL connection; pooled on Neon                     |
| `DIRECT_URL`            | Migration commands                     | Direct connection to the intended database                            |
| `TEST_DATABASE_URL`     | Integration tests and their migrations | Local PostgreSQL database with a name ending in `_test`               |
| `RATE_LIMIT_SECRET`     | Vercel client-address hashing          | Private 32–256-character secret, required on Vercel                   |
| `LINK_CREATION_ENABLED` | Operator creation switch               | Optional `true` (default) or `false`                                  |
| `BLOCKED_LINK_HOSTS`    | Creation and redirect policy           | Optional comma-separated hostnames, including their subdomains        |
| `RATE_LIMIT_SCOPE`      | Shared counter namespace               | Optional; defaults to `creation`. Keep constant within an environment |

Never commit actual credentials or expose them through `NEXT_PUBLIC_` variables.
Next.js loads its environment files; Prisma and the integration runner load
`.env.local`, then `.env`, while preserving existing environment variables.

Generate a private `RATE_LIMIT_SECRET` with `openssl rand -hex 32` and store it
separately in Vercel's Preview and Production environment settings. Never commit
the generated value. Local development needs no hashing secret. Do not set
`VERCEL=1` on directly reachable local or self-hosted servers; forwarded headers
are trusted only on Vercel. Tests select isolated counter namespaces automatically.

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
| `403`  | Destination host is blocked by the operator       |
| `413`  | Request body exceeds 8 KiB                        |
| `415`  | Content type is not `application/json`            |
| `429`  | Client or project-wide creation limit reached     |
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
clients or included in application error logs. Paused creation returns `503` with
`LINK_CREATION_PAUSED`. Rate-limited requests return `429`, `RATE_LIMITED`, and a
`Retry-After` interval in seconds; they never create a link.

### Creation limits and operator controls

Validated, permitted creation attempts are limited to **10 per client per fixed
10-minute window**, with **500 admitted attempts per UTC day per database and
counter namespace**. PostgreSQL stores the shared counters, so parallel requests
and separate application instances use the same allowance. Quota is reserved
before insertion; an admitted attempt still counts if the later insert fails.
A client rejection rolls back its daily reservation. Invalid input and blocked
destinations are rejected before quota access. Database or identity errors fail
closed with `503`. Fixed windows permit bursts across a window boundary.

On Vercel, identity uses the platform's `x-vercel-forwarded-for` address and a
secret-keyed SHA-256 hash. Raw addresses are neither stored in counter rows nor
logged by this code. Without Vercel, all callers share one restrictive bucket;
client-supplied forwarded headers cannot select a different one. Shared IPs share
an allowance; address changes can bypass the client limit, but the daily cap
remains. See [Vercel's header contract](https://vercel.com/docs/headers/request-headers).

Set `LINK_CREATION_ENABLED=false` to pause new links while keeping existing
redirects working. Set `BLOCKED_LINK_HOSTS=blocked.example,other.example` to block
those hosts and their subdomains during both creation and resolution, including
previously saved links. Entries are hostnames only, with no scheme, path, port,
or wildcard; up to 50 entries and 4,096 total characters are accepted. Case,
international domain names, and trailing dots are normalized. Invalid control
configuration fails closed. Changes to Vercel environment variables require a
redeployment to take effect.

Expired client counters are removed during the next admitted creation; there is
no scheduled cleanup worker. With a stable namespace, the daily cap also bounds
the number of client counter rows. Avoid changing the namespace to reset limits.
These controls bound admitted writes; rejected traffic still consumes requests
and database work. They do not scan destinations for malware or guarantee that
free hosting allowances cannot be exhausted. Monitor storage and traffic and keep
creation paused when the service needs operator attention.

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
receive `405`. Successful GET redirects record an aggregate count; HEAD does not.

A blocked destination returns `403` with `DESTINATION_BLOCKED` and no `Location`,
including through `HEAD`. The creation quota does not apply to redirects.

### Redirect error pages

Browsers receive a styled page for missing (`404`), blocked (`403`), and
unavailable (`503`) short links at the original URL. These pages work without
JavaScript, offer a home link, and provide a manual **Try again** link for `503`.
Errors never disclose the requested code, destination, or backend exception.
They remain non-cacheable and request no indexing; they never record clicks.

Redirect errors use the `Accept` header to choose HTML or the existing JSON shape.
An explicit acceptable `text/html` preference selects HTML when it outranks JSON;
an equal-quality explicit `application/json` preference wins the tie. Requests
without `Accept`, with only wildcards, or with an explicit JSON preference keep
JSON. `text/html;q=0` does not select HTML. Error responses include `Vary: Accept`,
`Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex, nofollow`. HTML also
uses a restrictive content-security policy with a hash-authorized stylesheet and
no scripts or external assets. HEAD selects the same headers without a body.
Successful `302` redirects and the POST API contract are unchanged.

```bash
curl -i -H 'Accept: application/json' http://localhost:3000/not-a-link
curl -i -H 'Accept: text/html' http://localhost:3000/not-a-link
curl -I -H 'Accept: text/html' http://localhost:3000/not-a-link
```

## Link stats

Select **View stats** after shortening, or open `/stats/<code>`. The page shows
the lifetime recorded total, today, and seven UTC dates with zero-filled days.
Refresh to see new counts. Anyone who knows the short code can view these
aggregates; they are not an owner-only dashboard. Stats request no indexing and
use `no-store`, but these are not access controls. There is no public link list.

Each permitted GET redirect increments a lifetime counter and one daily bucket
atomically in PostgreSQL. Bots, preview fetchers, QR scans, and repeat requests
count; unique visitors and destination loading are not measured. HEAD, stats
reads, malformed/missing codes, and blocked destinations do not count. A tracking
failure is logged by type only and leaves the redirect working, so totals can be
incomplete. Tracking is awaited before returning the redirect and adds a database
write; there is no background worker or external analytics service.

Existing links begin with zero when the analytics migration is applied; earlier
visits cannot be reconstructed. Analytics stores only link IDs, UTC dates, and
aggregate counters, without visitor IPs, user agents, referrers, cookies, or visitor
identifiers. Hosting providers may maintain their own request logs separately.
Daily buckets older than the visible seven days are removed on that link's next
recorded GET. Idle rows can remain until then; there is no scheduled purge. The
lifetime counter is retained, and deleting a link cascades its daily rows.

Malformed, missing, blocked, and unsafe links show the stats not-found screen.
Unexpected storage failures show a safe retry screen. Stats pages don't display
the original destination, and their reads use a consistent database snapshot.

## Architecture and schema

One Next.js App Router application owns pages and backend routes. The Node.js
route validates input, checks operator policy, and reserves shared quota before
calling the creation service. That service inserts
through Prisma, retrying only unique-index collisions on the short code.
The redirect service looks up only the destination through the code's unique
index. Malformed codes are rejected before querying PostgreSQL. Dynamic routing
and explicit cache headers ensure each valid visit resolves the current record.

| Link field       | PostgreSQL type          | Behavior                                                              |
| ---------------- | ------------------------ | --------------------------------------------------------------------- |
| `id`             | UUID                     | Primary key, generated by Prisma                                      |
| `code`           | Varchar(32)              | Unique lookup key; current generated codes are eight characters       |
| `destinationUrl` | Text                     | Normalized destination                                                |
| `createdAt`      | Timestamp with time zone | Database creation-time default                                        |
| `totalClicks`    | Bigint                   | Lifetime recorded GET redirects; zero for existing links on migration |

`RateLimitBucket` stores a unique counter key (`varchar(128)`), positive integer
`hits`, and indexed `expiresAt` timestamp. A transaction uses conditional SQL
upserts to reserve the global and client counters atomically. The clock comes
from PostgreSQL. The additive `add_creation_rate_limits` migration creates this
table without modifying existing links; apply it before running the new API.

`LinkClickDay` stores `linkId`, UTC `day`, and bigint `clicks`, with a composite
primary key `(linkId, day)` and cascade deletion. The additive
`add_link_analytics` migration adds the lifetime counter and daily table without
changing destinations or short codes. Apply it before using the new feature.
Bigint values are formatted as exact strings in the UI, preserving large counts.

`src/lib/db.ts` is server-only and creates its client lazily. The client is
reused per process, including development hot reloads, with a pool of two
connections and 10-second connection and idle timeouts. Each serverless instance
has its own pool.

```text
src/app/                 Pages, metadata, styles, and API routes
src/components/          Interactive shortening form and result
src/lib/http/            Bounded JSON request handling
src/lib/links/           Validation and collision-safe creation
src/lib/security/        Trusted client identity and shared creation quotas
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
collisions, concurrent creation and quota enforcement, expiry, atomic analytics,
retention, redirects, and API
responses. They remove only
their own records and never fall back to application or production credentials.

The database browser suite starts the production server with its application
connection explicitly overridden by the guarded test URL. It verifies creation,
redirect headers, browser navigation, referrer suppression, HEAD, deleted links,
and unsafe stored data. It also creates a link through the actual form, verifies
the saved database record, reads the copied URL, and opens the destination.
It also checks blocked stored destinations and verifies forged forwarded headers
cannot bypass the local quota. Counter namespaces are unique per test run. QR tests decode both the rendered
preview and downloaded PNG with an independent reader, verify the exact short
URL and local-only requests, and resolve a real saved link from decoded pixels.
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

`qrcode` 1.5.4 provides browser-side generation; `@types/qrcode` 1.5.6 provides
development types. The test-only `jsqr` 1.4.0 decoder checks the displayed and
downloaded images independently and is not imported by application code.

Exact versions and transitive package metadata are recorded in
`package-lock.json`. Dependency notices are included with installed packages.

| Dependencies                                                         | License                                    |
| -------------------------------------------------------------------- | ------------------------------------------ |
| Node.js, Next.js, React, Tailwind CSS, PostCSS                       | MIT, with bundled notices where applicable |
| ESLint, Prettier, Vitest, Testing Library, jsdom                     | MIT                                        |
| `pg`, `server-only`, `qrcode`, `@types/*`                            | MIT                                        |
| TypeScript, Prisma CLI/Client/PostgreSQL adapter, Playwright, `jsqr` | Apache-2.0                                 |
| `dotenv`                                                             | BSD-2-Clause                               |
| PostgreSQL server                                                    | PostgreSQL License                         |

Browser distributions and container images retain their own bundled notices.
Hosted services are governed by their service terms and free-tier limits.
ESLint 9 currently matches the installed Next.js lint plugins' peer requirements;
its support warning is recorded for a coordinated tooling upgrade.
