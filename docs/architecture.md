# Architecture

## Phase 1: application and database foundation

ShortLink is a single Next.js application. The App Router owns pages and, in later
phases, backend route handlers. Keeping the interface and backend in one repository
reduces deployment and maintenance work for a small portfolio project.

The current interface is a static introduction page. A database schema and
server-only query client are implemented, with no public shortening, redirect,
analytics, or external API endpoints yet. The production build requires neither
credentials nor a database connection.

| Area                 | Choice                                     | Reason                                                             |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Runtime              | Node.js 24.x                               | Supported by Vercel and shared by local setup instructions and CI. |
| Application          | Next.js 16 App Router and React            | One application for the interface and future backend.              |
| Language             | TypeScript with strict checking            | Catch invalid assumptions while developing.                        |
| Styling              | Tailwind CSS 4                             | Responsive styling without a component framework dependency.       |
| Code quality         | ESLint flat configuration and Prettier     | Separate code checks from consistent formatting.                   |
| Unit/component tests | Vitest, Testing Library, jsdom             | Exercise rendering and behavior without a browser service.         |
| Browser tests        | Playwright with Chromium                   | Check the running application, including its production build.     |
| CI                   | GitHub Actions on a standard Ubuntu runner | Repeat the same checks on pushes and pull requests.                |

No remote fonts are fetched during the build. Dependencies are installed and
resolved versions are recorded in `package-lock.json`. Checkouts and CI use
`npm ci` for reproducibility.
Use Node 24 consistently for local development, CI, and hosting.

## Project boundaries

- `src/app/`: App Router layout, page, metadata, and global styles.
- `src/lib/`: Lazy server-only database access and configuration checks.
- `prisma/`: Schema and reviewed, versioned SQL migrations.
- Component tests: small rendering and behavior checks alongside the application.
- `tests/e2e/`: Playwright checks against a running application.
- `tests/integration/`: Tests against a dedicated local PostgreSQL database.
- `.github/workflows/`: automated validation.
- `docs/`: architecture, API status, deployment, and dependency decisions.

CI checks formatting, linting, schema validity, TypeScript, unit tests, production
build, and browser tests without database credentials. A separate job creates a
PostgreSQL 17 service container, applies the migration, and runs integration tests.
No hosted database secrets or uploaded test artifacts are needed.

## PostgreSQL and Prisma

Prisma 7.10.1, its PostgreSQL adapter, and `pg` are installed. The `Link` model has
a UUID identity, unique short code, text destination, and creation timestamp.
See [the database guide](database.md) for schema details and local setup.

The intended request path is:

```text
Browser -> Next.js page or route handler -> Prisma -> PostgreSQL
```

Future database routes use the Node.js runtime. `getDb()` creates a client lazily
and caches it per process across requests and hot reloads. The pool has at most
two connections and 10-second connection and idle timeouts. Each serverless
instance has its own pool; production uses Neon's pooled URL. Migration commands
use the separate `DIRECT_URL` and run explicitly, not during builds.

Client generation runs during installation, type checks, and builds and does not
connect to the database. Generated files are ignored by Git, ESLint, and Prettier.
Migrations are committed SQL applied through `db:deploy`; local schema development
uses `db:migrate`. Preview and production databases must be isolated before write
operations are deployed. Integration migrations use only `TEST_DATABASE_URL`,
guarded to require localhost and a `_test` database.

URL redirects, click recording, and analytics will use our backend and database.
QR codes will be generated locally with an open-source package. These features
must stay within free-tier resources without paid APIs or required background jobs.

## Configuration and security

`.env.example` documents local application, migration, and test connections. Copy
it to `.env.local` when doing database work; keep real credentials out of Git.
`DATABASE_URL` is checked only when `getDb()` is first called. Configuration errors
name the variable without its value. Never expose credentials through a
`NEXT_PUBLIC_` variable, a response, or logs. URL validation, abuse controls, and
HTTP error responses will be implemented with the shortening endpoint.
