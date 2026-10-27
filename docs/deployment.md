# Deployment

Phase 0 is pushed to GitHub and its CI run passed. Phase 1's database foundation
passes local verification on `feat/database-foundation`. Its PR,
remote CI run, Vercel connection, Neon database, and live URL remain pending.

## Zero-cost hosting choices

Official allowances checked on **2026-10-26**. Providers can change their plans;
recheck these links before creating resources or changing configuration.

| Service                                                                                      | Free allowance relevant to ShortLink                                                                                                                                                     | Operating constraint                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [Vercel Hobby](https://vercel.com/docs/plans/hobby)                                          | 100 GB fast transfer, 10 GB origin transfer, 1 million CDN requests, 4 CPU hours, 360 GB hours of provisioned memory, and 1 million function invocations per month; 100 deployments/day. | Personal, noncommercial projects only. Excess usage generally pauses the affected resource until its allowance resets. Stay on Hobby.       |
| [Neon Free](https://neon.com/docs/introduction/plans)                                        | 100 projects; 10 branches/project; 100 CU hours/project/month; 1 GB PostgreSQL storage/project, 20 GB/account; 5 GB public transfer/project/month.                                       | Compute sleeps after 5 inactive minutes. No uptime SLA; cold starts are expected. Keep databases within the Free allowance.                 |
| [GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions) | Standard GitHub-hosted runners are free for public repositories.                                                                                                                         | Use standard Ubuntu runners. This workflow does not upload artifacts; private repositories and larger runners have different billing rules. |

[Neon's Free plan](https://neon.com/pricing) has no time limit and requires no credit
card. Vercel supplies a free `.vercel.app` domain. Paid upgrades, trials, add-ons,
and custom domain purchases are unnecessary. If a free allowance is exhausted,
reduce usage or wait for its reset; do not enable billable capacity.

## Connect GitHub to Vercel

1. Push the verified feature branch, open a PR, and merge into `main` after review
   and green CI. This public repository uses free standard Actions runners.
2. Sign in to Vercel and stay on the **Hobby** plan. Choose **Add New > Project**,
   connect GitHub, and import this repository with only the necessary access.
3. Select the **Next.js** framework preset and the repository root as the root
   directory. Use `npm ci --include=dev`, `npm run build`, and Next.js's default
   output settings. Development dependencies include the build-time Prisma CLI.
   Select Node.js **24.x**, matching the project configuration. See
   [supported runtimes](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
4. Configure `main` as the production branch. Other branch pushes and pull requests
   should create preview deployments. Confirm that automatic Git deployments are
   enabled in the project's Git settings.
5. The introduction page needs no database variables. `npm ci` and the build
   generate Prisma Client without connecting to PostgreSQL or applying migrations.
   Deploy and record the actual `.vercel.app` URL only after success.
6. Add that verified URL to the README and GitHub repository description. Do not
   create a `v1.0.0` tag until the complete application's production checks pass.

Before Vercel is connected, Git pushes only publish source and trigger configured
GitHub Actions. After connection, a push to `main` triggers production; a feature
branch push triggers a preview. Vercel deployments and GitHub Actions run
independently: a green build alone does not imply every CI check passed. Review CI
and the preview before merging a pull request into `main`.

## Hosted database setup

The schema and connection code are implemented. Create a Neon **Free** project
when preparing deployment of database-backed routes. Keep development, preview,
and production isolated within the free allowance. Production and preview must
never share a writable database. Local setup is in [the database guide](database.md).

Set `DATABASE_URL` to the pooled application connection and reserve `DIRECT_URL`
for a direct migration connection as required by the selected Prisma setup. Enter
values in Vercel's environment settings for the correct environment scope; use
preview database credentials only for Preview and production credentials only for
Production. Keep local credentials in ignored environment files. Never paste
secrets into Git, documentation, or pull requests.

Prisma Client generation is already part of installation and the build. With
`DIRECT_URL` set securely for the intended environment, inspect migration state
and apply the reviewed migrations as an explicit release step:

```bash
npm run db:status
npm run db:deploy
```

Run deployment from an environment that installs development tooling, including
the pinned Prisma CLI. `db:migrate` is for local schema development only. Neither
the Next.js build nor CI applies migrations to hosted databases. The integration
job migrates only its disposable local PostgreSQL service.

## Verify a deployment

1. Confirm GitHub Actions passed lint, formatting, type checking, unit tests,
   production build, and Playwright browser tests for the deployed commit.
2. Confirm the Vercel deployment status is Ready and its commit matches the intended
   branch. Open its HTTPS URL on desktop and mobile widths.
3. Check the page title, visible main heading, keyboard navigation, and absence of
   browser errors. Verify the introductory page clearly reflects the current
   implementation status.
4. Once persistence is implemented, test creation, redirect, invalid input, missing
   short codes, and analytics against the correct environment. Confirm preview
   writes never appear in production. Inspect logs without exposing credentials.

## Roll back a release

In Vercel, select the previous verified production deployment and use the available
rollback or promotion control. If the account does not offer that control,
redeploy a prior verified commit through Vercel or revert the bad change through a
new GitHub pull request. Confirm the resulting production commit and repeat the
deployment checks; keep GitHub history consistent with the deployed state.

An application rollback does not undo a database migration. Future schema changes
must preserve compatibility with the previous application version where possible.
Do not reverse a production migration or discard data as part of a routine app
rollback; plan a reviewed forward fix when schema compatibility prevents rollback.
