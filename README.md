# Shrtnr. — ShortLink

A lightweight URL shortener built as a full-stack portfolio project, one verified
milestone at a time. The planned stack is Next.js, TypeScript, PostgreSQL, Prisma,
and Tailwind CSS, hosted on Vercel Hobby with a Neon Free database.

**Current milestone: Phase 0 — project foundation.** The starter page, development
configuration, tests, CI workflow, and documentation are ready. Dependencies are
installed and locked, and local formatting, linting, TypeScript, component tests,
production build, and browser tests pass under Node.js 24.22.1. The first commit,
GitHub push, remote CI run, and deployment remain pending.

**Live demo:** pending deployment. Shortening, redirects, QR codes, and analytics
will be implemented in later phases.

## 1. Goal

Establish a small, maintainable application with repeatable local checks and CI
before adding URL-shortening features. Stop after Phase 0 for verification.

## 2. Architecture

- One Next.js 16 App Router application with React and strict TypeScript.
- Tailwind CSS 4 with system fonts; no font downloads or external APIs at build time.
- Node.js 24.x in `.nvmrc`, package engines, CI, and the deployment instructions.
- ESLint for code checks, Prettier for formatting, Vitest for component tests,
  and Playwright for production browser tests.
- Database packages and configuration will be added with persistence in Phase 1.
  This milestone needs no secrets or database.

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

**Commit `package-lock.json` with the first verified milestone.** Use `npm ci` on
fresh checkouts and in CI. Use `npm install` when deliberately changing
dependencies, and review the resulting lockfile changes.

No `.env` file is required now. `.env.example` reserves future server-only
database variables; when persistence is added, copy it to `.env.local` and replace
the placeholders. Environment files containing real values stay out of Git.

```text
src/app/                 Layout, introduction page, styles, component test
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

All six commands above passed locally on **2026-10-26** under **Node.js 24.22.1**:
one Vitest component test and two Chromium browser tests. The dependency
installation also reported zero known vulnerabilities.

For an additional manual check, view the page at desktop and mobile widths and
use Tab then Enter to follow **Skip to content**. Look for browser errors and
horizontal scrolling. The keyboard and mobile overflow checks are automated;
a separate visual review has not been performed.

CI runs the same checks on pushes to `main` and on pull requests, using a standard
Ubuntu runner with read-only repository permissions and no database secrets. It
does not upload test artifacts. Its first successful remote run is still pending.

## 5. Documentation

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

Current local branch: **`main`**, initialized with no commits. The public GitHub
repository is <https://github.com/yassir-chouika/ShortLink>; its URL and access were
confirmed. A local remote, commit, and push have not been configured or performed.

The first commit belongs on `main` as the verified baseline. The local checks above
have passed. Review the changed files and lockfile, and configure your Git author
if needed. Then follow [the exact first-push steps](docs/git-workflow.md#first-push).
The proposed commit is:

```text
chore: initialize ShortLink development foundation
```

There is no Phase 0 pull request; future milestones use short-lived feature
branches and a reviewed PR into `main`. Before Vercel is connected, pushes trigger
only GitHub Actions. After connection, `main` pushes trigger production, and
feature branches and PRs trigger previews. Review both CI and the preview before
merging. Do not tag `v1.0.0` before a complete, verified production deployment.

## 7. Next milestone

After Phase 0 is verified: introduce PostgreSQL and Prisma with a minimal link
schema, a reviewed first migration, server-only connection handling, and database
verification. No Phase 1 implementation has been started.
