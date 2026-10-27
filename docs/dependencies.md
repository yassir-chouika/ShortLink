# Dependencies and cost

ShortLink uses open-source application and development packages. None requires
a paid API key, subscription, or hosted testing service. Installed versions are
recorded in `package-lock.json`; commit that file so subsequent `npm ci` runs
reproduce them. The initial installation reported zero known vulnerabilities.

## Application and tooling

| Package or tool                                                                                                                                  | Purpose                                     | License                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------- |
| [Node.js](https://github.com/nodejs/node/blob/main/LICENSE)                                                                                      | Application and tooling runtime             | MIT, with bundled third-party notices |
| [Next.js](https://github.com/vercel/next.js/blob/canary/license.md) (`next`, `eslint-config-next`)                                               | App Router and framework lint rules         | MIT                                   |
| [React](https://github.com/facebook/react/blob/main/LICENSE) (`react`, `react-dom`)                                                              | Interface rendering                         | MIT                                   |
| [TypeScript](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)                                                                      | Static type checking                        | Apache-2.0                            |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE) (`tailwindcss`, `@tailwindcss/postcss`)                            | Styling and PostCSS integration             | MIT                                   |
| [PostCSS](https://github.com/postcss/postcss/blob/main/LICENSE)                                                                                  | Stylesheet processing                       | MIT                                   |
| [ESLint](https://github.com/eslint/eslint/blob/main/LICENSE)                                                                                     | Code linting                                | MIT                                   |
| [Prettier](https://github.com/prettier/prettier/blob/main/LICENSE)                                                                               | Formatting                                  | MIT                                   |
| [Vitest](https://github.com/vitest-dev/vitest/blob/main/LICENSE)                                                                                 | Unit and component test runner              | MIT                                   |
| [Testing Library](https://github.com/testing-library/react-testing-library/blob/main/LICENSE) (`@testing-library/react`, `@testing-library/dom`) | User-facing component queries and rendering | MIT                                   |
| [Testing Library jest-dom](https://github.com/testing-library/jest-dom/blob/main/LICENSE)                                                        | DOM assertion matchers                      | MIT                                   |
| [jsdom](https://github.com/jsdom/jsdom/blob/main/LICENSE.txt)                                                                                    | DOM environment for component tests         | MIT                                   |
| [Playwright](https://github.com/microsoft/playwright/blob/main/LICENSE) (`@playwright/test`)                                                     | Browser automation and assertions           | Apache-2.0                            |
| [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/LICENSE) (`@types/node`, `@types/react`, `@types/react-dom`)    | Type definitions                            | MIT                                   |

Installed dependency licenses and notices remain available under `node_modules`.
This table covers direct choices; bundled and transitive components retain their
own licenses. Playwright downloads browser binaries separately, which include
their upstream notices. Tests run locally and in GitHub Actions without a paid
browser-testing provider.

ESLint 9 is retained to satisfy the installed React, import, and accessibility
plugins' peer dependencies. npm marks this major as out of support; update the
preset and its plugins together when they support a maintained ESLint version,
rather than forcing incompatible peer dependencies.

## Database packages and planned QR generation

Prisma, its PostgreSQL adapter, PostgreSQL, and `pg` are now used in Phase 1.
The Prisma license covers `prisma`, `@prisma/client`, and `@prisma/adapter-pg`.
`qrcode` remains a planned addition for a later phase.

| Dependency                                                                   | Intended purpose                                | License and cost                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| [Prisma ORM](https://github.com/prisma/orm/blob/main/LICENSE)                | Schema, migrations, and typed database access   | Apache-2.0; no Prisma cloud subscription required. |
| [PostgreSQL](https://www.postgresql.org/about/licence/)                      | Persistent links and click records              | PostgreSQL License; open source.                   |
| [node-postgres](https://github.com/brianc/node-postgres/blob/master/LICENSE) | PostgreSQL driver for the chosen Prisma adapter | MIT; local library.                                |
| [qrcode](https://github.com/soldair/node-qrcode/blob/master/license)         | Generate QR codes locally                       | MIT; no external QR API.                           |

Additional Phase 1 dependencies:

| Package       | Purpose                                        | License      |
| ------------- | ---------------------------------------------- | ------------ |
| `server-only` | Reject imports into Next.js client bundles     | MIT          |
| `dotenv`      | Load local environment files for CLI and tests | BSD-2-Clause |
| `@types/pg`   | PostgreSQL driver type definitions             | MIT          |

Prisma packages are pinned to 7.10.1 because the current `latest` tag points to
Prisma 8's release candidate. No Prisma-hosted service or subscription is used.
On npm 12, `allowScripts` approves installation hooks only for the pinned Prisma
CLI and engines. Reassess those entries when upgrading; they do not approve
scripts for all dependency versions.

The temporary PostgreSQL binary bundle used for local verification is installed
only under `/tmp`, not in the application dependencies. Its MIT wrapper and
Apache-2.0 binary packaging retain PostgreSQL's and bundled components' notices.
Regular development and CI use local PostgreSQL or the standard PostgreSQL image.

Confirm compatibility and licenses when introducing a package. Add its purpose and
any service limits here rather than introducing unnecessary APIs or SDKs.

## Hosted services

Vercel, Neon, and GitHub are hosted services governed by their service terms; an
open-source library license does not grant unlimited hosted resources. Their free
allowances were checked on **2026-10-26** and are recorded with official sources in
[the deployment guide](deployment.md#zero-cost-hosting-choices).

The project must remain on Vercel Hobby, Neon Free, and free GitHub resources. A
free trial does not qualify. Do not enable paid plans or billable add-ons; if an
allowance prevents a feature from operating, document the limit and reduce scope
or usage while preserving the €0 requirement.
