# Shrtnr. — ShortLink

A lightweight URL shortener with downloadable QR codes and simple click stats.
Built with Next.js, TypeScript, PostgreSQL, Prisma, and Tailwind CSS.

**[Try the live demo](https://short-link-orpin.vercel.app/)**

## Features

- Shorten HTTP(S) URLs and copy or share the result.
- Generate and download QR codes directly in the browser.
- View lifetime clicks and daily counts for the last seven UTC dates.
- Responsive interface with keyboard navigation and clear error feedback.
- URL validation, shared creation limits, and operator controls.

Stats are visible to anyone with the short code. Counts include repeat visits
and bots; they do not represent unique visitors.

## Run locally

Requires **Node.js 24**, npm, and **Docker Engine with Compose** (or PostgreSQL 17).

```bash
git clone https://github.com/yassir-chouika/ShortLink.git
cd ShortLink
npm ci
cp .env.example .env.local
docker compose up -d --wait
npm run db:deploy
npm run dev
```

Open [localhost:3000](http://localhost:3000). The example environment matches the
local Docker database. If using your own PostgreSQL instance, update
`DATABASE_URL` and `DIRECT_URL` in `.env.local` before applying migrations.

`DATABASE_URL` is the application connection; `DIRECT_URL` is used for migrations.
Keep real credentials in environment variables or ignored environment files.
Optional controls are documented in [.env.example](.env.example).

## Development

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For browser tests, install Chromium once with `npx playwright install chromium`,
then run `npm run test:e2e` after building. On Linux, browser system dependencies
may also be needed.

Database tests require a separate local test database:

```bash
# Create once per local Docker volume.
docker compose exec postgres createdb -U shortlink shortlink_test
npm run test:integration
npm run test:e2e:database
```

`TEST_DATABASE_URL` in `.env.local` must point to that local database, with a name
ending in `_test`. Run the production build before the database browser suite.

## Deployment

Hosted on **Vercel** with **Neon PostgreSQL**. To deploy your own instance, use
Node.js 24, a pooled `DATABASE_URL`, and a private `RATE_LIMIT_SECRET` generated
with `openssl rand -hex 32`. Apply committed migrations separately with
`npm run db:deploy` using the intended database's direct `DIRECT_URL`.

Builds generate Prisma Client but do not apply migrations. Keep production and
preview databases separate and configure their environment variables accordingly.
