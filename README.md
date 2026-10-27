# Shrtnr. — ShortLink

A lightweight URL shortener built as a full-stack portfolio project, one verified
milestone at a time. The planned stack is Next.js, TypeScript, PostgreSQL, Prisma,
and Tailwind CSS, hosted on Vercel Hobby with a Neon Free database.

**Current milestone: Phase 1 — database foundation.** PostgreSQL persistence,
Prisma migrations, server-only access, and integration tests are implemented.
Phase 0 is committed on `main` and its GitHub CI run passed. Phase 1 is on
`feat/database-foundation`; its commit, PR, and deployment are pending.

**Live demo:** pending deployment. Shortening, redirects, QR codes, and analytics
will be implemented in later phases.

## 1. Goal

Establish tested persistence before adding URL-shortening endpoints. Stop after
Phase 1 for verification; public creation and redirects are not implemented.

## 2. Architecture

- One Next.js 16 App Router application with React and strict TypeScript.
- Tailwind CSS 4 with system fonts; no font downloads or external APIs at build time.
- Node.js 24.x in `.nvmrc`, package engines, CI, and the deployment instructions.
- ESLint for code checks, Prettier for formatting, Vitest for component tests,
  and Playwright for production browser tests.
- PostgreSQL 17 and Prisma 7.10.1 with the `pg` adapter, a small connection pool,
  and lazy server-only access through `getDb()`.
- Separate application, migration, and test URLs. Client generation is automatic;
  applying migrations is an explicit command.

See [architecture](docs/architecture.md), [API status](docs/api.md),
[dependency licenses](docs/dependencies.md), and
[hosting limits and deployment](docs/deployment.md).

## 3. Implementation and local setup

Prerequisites: Git, Node.js **24.x**, and its bundled npm. If you use `nvm`:

```bash
nvm install
nvm use
node --version
```

The expected Node major is 24.

Install the locked dependencies and the browser used by the tests:

```bash
npm ci
npx playwright install chromium
npm run dev
```

Open <http://localhost:3000>. On Linux, if Playwright reports missing system
libraries, follow its instructions or run `npx playwright install --with-deps chromium`.
Stop the development server with Ctrl+C when finished.

**Keep `package-lock.json` committed with dependency changes.** Use `npm ci` on
fresh checkouts and in CI. Use `npm install` when deliberately changing
dependencies, and review the resulting lockfile changes.

The introduction page and builds require no environment file. For database work,
copy `.env.example` to `.env.local` and follow the [database guide](docs/database.md).
It covers Docker Compose and existing local PostgreSQL installations. Integration
tests require a separate local database whose name ends in `_test`. Real
credentials stay out of Git.

```text
src/app/                 Layout, introduction page, styles, component test
src/lib/                 Server-only database access and configuration checks
prisma/                  Schema and versioned SQL migrations
tests/integration/       PostgreSQL persistence and transaction tests
tests/unit/              Test-database isolation checks
tests/setup.ts           Shared DOM test setup
tests/e2e/               Browser tests
.github/workflows/ci.yml GitHub Actions checks
docs/                    Architecture, API, dependencies, deployment, Git guide
```

## 4. Verification

After installation (use `npm run format` when formatting changes are needed):

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright starts `next start` against the production build, checks the title and
keyboard skip link, and checks that the page fits a mobile viewport. The Vitest
test checks the introductory heading and the visible availability status. Use
`npm run test:watch` while developing.

The separate database suite requires a configured local test database:

```bash
npm run db:validate
npm run test:integration
```

It applies the committed migration to that database, then tests persistence,
lookup, uniqueness, and rollback. See [database verification](docs/database.md#verification-and-isolation).

Verified locally on **2026-10-27** with **Node.js 24.22.1** and **PostgreSQL 17.10**:
clean install and client generation, formatting, lint, schema validation, strict
TypeScript, 14 unit/component tests, 4 database integration tests, production
build, and 2 Chromium browser tests. No hosted database was created.

For an additional manual check, view the page at desktop and mobile widths and
use Tab then Enter to follow **Skip to content**. Look for browser errors and
horizontal scrolling. The keyboard and mobile overflow checks are automated;
a separate visual review has not been performed.

CI runs application checks without database URLs and a separate integration job
with a disposable PostgreSQL service. Both use standard Ubuntu runners and
read-only repository permissions, without hosted database secrets or uploaded
artifacts. Phase 0's remote CI passed; Phase 1 needs a new PR run.

## 5. Documentation

The [database guide](docs/database.md) explains the schema, connections, local
setup, migrations, and test isolation.

| Guide                                | Contents                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------ |
| [Architecture](docs/architecture.md) | Application boundaries, tooling, future database decisions               |
| [API](docs/api.md)                   | Current endpoint status and tentative future routes                      |
| [Dependencies](docs/dependencies.md) | Package purposes, open-source licenses, planned additions                |
| [Deployment](docs/deployment.md)     | Verified free-tier limits, Vercel setup, environment isolation, rollback |
| [Git workflow](docs/git-workflow.md) | First push, feature branches, pull requests, switching computers         |

All required hosting must stay at **€0**. A personal, noncommercial portfolio fits
[Vercel Hobby's terms](https://vercel.com/docs/plans/hobby); the planned database
uses [Neon Free](https://neon.com/pricing). Standard GitHub-hosted runners are
[free for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Plan allowances checked on 2026-10-26 are documented in the deployment guide.
No paid API, trial, purchased domain, or background worker is required.

## 6. Git checkpoint

Current branch: **`feat/database-foundation`**, based on the pushed Phase 0 commit
`8c53ff4` on `main`. The repository is <https://github.com/yassir-chouika/ShortLink>.
No Phase 1 commit or push has been made.

After local checks pass, review the schema, migration, client, tests, CI,
environment example, lockfile, and docs as one milestone. Follow the
[Phase 1 checkpoint](docs/git-workflow.md#phase-1-checkpoint). Proposed commit:

```text
feat: add PostgreSQL and Prisma database foundation
```

Push this branch and open a PR into `main`; opening the PR triggers CI. If Vercel
is connected, the feature push creates a preview and merging into `main` triggers
production. Review both CI jobs and any preview before merging. Do not tag
`v1.0.0` before a complete, verified production deployment.

## 7. Next milestone

After Phase 1 is verified: implement the first validated link-creation endpoint,
short-code generation, collision handling, and API documentation. Redirects,
analytics, and QR codes remain later work.
