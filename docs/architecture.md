# Architecture

## Phase 0: application foundation

ShortLink is a single Next.js application. The App Router owns pages and, in later
phases, backend route handlers. Keeping the interface and backend in one repository
reduces deployment and maintenance work for a small portfolio project.

The current application is a static introduction page. It has no shortening,
redirection, analytics, database access, or external API integrations yet. Its
production build requires neither credentials nor a database connection.

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
resolved versions are recorded in `package-lock.json`. Include that file in the
first commit; subsequent checkouts and CI use `npm ci` for reproducibility.
Use Node 24 consistently for local development, CI, and hosting.

## Project boundaries

- `src/app/`: App Router layout, page, metadata, and global styles.
- Component tests: small rendering and behavior checks alongside the application.
- `tests/e2e/`: Playwright checks against a running application.
- `.github/workflows/`: automated validation.
- `docs/`: architecture, API status, deployment, and dependency decisions.

CI installs dependencies, then checks linting, formatting, TypeScript, unit tests,
the production build, and browser tests. It needs no database secrets. Test reports
remain local; the workflow does not upload artifacts to hosted storage.

## Planned database and backend

PostgreSQL and Prisma will be introduced in the next phase together with their
schema, migrations, connection handling, and tests. They are not installed or
configured in Phase 0.

The intended request path is:

```text
Browser -> Next.js page or route handler -> Prisma -> PostgreSQL
```

Use the Node.js runtime for database routes, a pooled connection URL for application
requests, and a direct connection URL for migration tooling when appropriate. Keep
Prisma access in a server-only module, reuse the client during development, and
bound connection pools for Vercel's serverless environment. Confirm these settings
against the Prisma version installed during that phase.

Build-time client generation and schema migrations have different purposes.
Client generation may become part of installation or build setup; production
migrations must be an explicit, controlled step and must not run during every
preview or ordinary application build. Preview and production databases must be
isolated before write operations are deployed.

URL redirects, click recording, and analytics will use our backend and database.
QR codes will be generated locally with an open-source package. These features
must stay within free-tier resources without paid APIs or required background jobs.

## Configuration and security

`.env.example` documents reserved database variables. Copy it to `.env.local` only
when needed, and keep actual credentials out of Git. Nothing in Phase 0 reads
`DATABASE_URL` or `DIRECT_URL`. Never expose credentials through a `NEXT_PUBLIC_`
variable, a response, or logs. Future URL validation, abuse controls, and error
responses will be designed and tested when shortening is implemented.
