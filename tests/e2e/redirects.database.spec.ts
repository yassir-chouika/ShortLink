import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { getTestDatabaseUrl } from '../helpers/test-database-url';
import { decodeQrPng } from '../helpers/decode-qr';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getTestDatabaseUrl(), max: 1 }),
});
const ids: string[] = [];
const runId = randomUUID();
let destinationOrigin: string;
let destinationReferrer: string | undefined;
const destinationServer = createServer((request, response) => {
  if (
    new URL(request.url ?? '/', 'http://localhost').pathname !==
    `/${runId}/browser`
  ) {
    response.writeHead(404).end();
    return;
  }
  destinationReferrer = request.headers.referer;
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(
    '<!doctype html><html lang="en"><title>Destination</title><h1>Saved destination</h1></html>',
  );
});

test.beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    destinationServer.once('error', reject);
    destinationServer.listen(0, '127.0.0.1', () => {
      destinationServer.off('error', reject);
      resolve();
    });
  });
  const address = destinationServer.address();
  if (!address || typeof address === 'string')
    throw new Error('Destination fixture did not start.');
  destinationOrigin = `http://127.0.0.1:${address.port}`;
});

async function createViaApi(
  request: APIRequestContext,
  destinationUrl: string,
) {
  const response = await request.post('/api/links', {
    data: { url: destinationUrl },
  });
  expect(response.status()).toBe(201);
  const { data } = await response.json();
  ids.push(data.id);
  return data.code as string;
}

test.afterAll(async () => {
  try {
    await db.link.deleteMany({ where: { id: { in: ids } } });
    const scope = process.env.RATE_LIMIT_SCOPE;
    if (!scope?.startsWith('e2e_'))
      throw new Error('Missing isolated browser quota scope.');
    await db.rateLimitBucket.deleteMany({
      where: { key: { startsWith: `${scope.replaceAll('_', '\\_')}:` } },
    });
  } finally {
    const closeDestination = destinationServer.listening
      ? new Promise<void>((resolve, reject) => {
          destinationServer.close((error) =>
            error ? reject(error) : resolve(),
          );
        })
      : Promise.resolve();
    await Promise.all([db.$disconnect(), closeDestination]);
  }
});

test('creation and resolution work through the production HTTP server', async ({
  request,
}) => {
  const destination = `${destinationOrigin}/${runId}/http?saved=1#details`;
  const code = await createViaApi(request, destination);
  const response = await request.get(`/${code}?ignored=1`, { maxRedirects: 0 });

  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
});

test('a browser follows the saved destination without forwarding the referrer', async ({
  page,
  request,
}) => {
  const destination = `${destinationOrigin}/${runId}/browser?saved=1#details`;
  const code = await createViaApi(request, destination);
  await page.goto('/');
  await page.evaluate((href) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = 'Follow saved link';
    document.body.append(link);
  }, `/${code}?ignored=1`);
  await page.getByRole('link', { name: 'Follow saved link' }).click();

  await expect(page).toHaveURL(destination);
  await expect(
    page.getByRole('heading', { name: 'Saved destination' }),
  ).toBeVisible();
  expect(destinationReferrer).toBeUndefined();
});

test('HEAD returns the redirect headers without a body', async ({
  request,
  page,
}) => {
  const destination = `${destinationOrigin}/${runId}/head`;
  const code = await createViaApi(request, destination);
  const response = await request.head(`/${code}`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
  expect(await response.text()).toBe('');
  await page.goto(`/stats/${code}`);
  await expect(
    page.getByText(/No redirects recorded in the last seven days/),
  ).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(8);
});

test('the form creates, copies, and opens a persisted short link', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:3000',
  });
  const destination = `${destinationOrigin}/${runId}/browser?from=form#details`;
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Your long link' }).fill(destination);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/links') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Shorten link' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const { data } = await response.json();
  ids.push(data.id);
  const shortUrl = `http://127.0.0.1:3000/${data.code}`;
  await expect(
    page.getByRole('textbox', { name: 'Your short link' }),
  ).toHaveValue(shortUrl);
  expect(
    (await db.link.findUniqueOrThrow({ where: { id: data.id } }))
      .destinationUrl,
  ).toBe(destination);
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    shortUrl,
  );
  await page.getByRole('button', { name: 'Show QR code' }).click();
  const qr = page.getByRole('img', { name: 'QR code for your short link' });
  await expect(qr).toBeVisible();
  const qrSource = await qr.getAttribute('src');
  const decoded = await decodeQrPng(
    page,
    Array.from(Buffer.from(qrSource!.split(',')[1], 'base64')),
  );
  expect(decoded).toBe(shortUrl);
  const resolved = await page.request.get(decoded!, { maxRedirects: 0 });
  expect(resolved.status()).toBe(302);
  expect(resolved.headers().location).toBe(destination);
  const opened = page.waitForEvent('popup');
  await page.getByRole('link', { name: /Open link/ }).click();
  const popup = await opened;
  await expect(popup).toHaveURL(destination);
  await expect(
    popup.getByRole('heading', { name: 'Saved destination' }),
  ).toBeVisible();
  expect(destinationReferrer).toBeUndefined();
  await popup.close();
  await page.getByRole('link', { name: 'View stats' }).click();
  await expect(page).toHaveURL(`/stats/${data.code}`);
  await expect(
    page.getByRole('heading', { name: 'Your link, in numbers.' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('term')
      .filter({ hasText: 'Total recorded' })
      .locator('..')
      .getByRole('definition'),
  ).toHaveText('2');
  await page.reload();
  await expect(
    page
      .getByRole('term')
      .filter({ hasText: 'Total recorded' })
      .locator('..')
      .getByRole('definition'),
  ).toHaveText('2');
  expect(
    (await db.link.findUniqueOrThrow({ where: { id: data.id } })).totalClicks,
  ).toBe(BigInt(2));
  await page.setViewportSize({ width: 320, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test('a deleted link returns 404 rather than a cached redirect', async ({
  request,
  page,
}) => {
  const code = await createViaApi(
    request,
    `${destinationOrigin}/${runId}/deleted`,
  );
  expect((await request.get(`/${code}`, { maxRedirects: 0 })).status()).toBe(
    302,
  );
  await db.link.delete({ where: { code } });
  const response = await request.get(`/${code}`, { maxRedirects: 0 });
  expect(response.status()).toBe(404);
  expect(response.headers().location).toBeUndefined();
  expect(response.headers()['cache-control']).toBe('no-store');
  expect((await page.goto(`/${code}`))?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'This link is missing.' }),
  ).toBeVisible();
});

test('unsafe stored destinations cannot become redirect headers', async ({
  request,
}) => {
  const link = await db.link.create({
    data: {
      code: randomBytes(6).toString('base64url'),
      destinationUrl: 'javascript:alert(1)',
    },
  });
  ids.push(link.id);
  const response = await request.get(`/${link.code}`, { maxRedirects: 0 });
  expect(response.status()).toBe(503);
  expect(response.headers().location).toBeUndefined();
  expect(await response.text()).not.toContain(link.destinationUrl);
});

test('an existing link to a blocked host cannot redirect through GET or HEAD', async ({
  request,
  page,
}) => {
  const link = await db.link.create({
    data: {
      code: randomBytes(6).toString('base64url'),
      destinationUrl: 'https://sub.blocked.example/path',
    },
  });
  ids.push(link.id);
  const response = await request.get(`/${link.code}`, { maxRedirects: 0 });
  expect(response.status()).toBe(403);
  expect(response.headers().location).toBeUndefined();
  expect((await response.json()).error.code).toBe('DESTINATION_BLOCKED');
  const head = await request.head(`/${link.code}`, { maxRedirects: 0 });
  expect(head.status()).toBe(403);
  expect(await head.text()).toBe('');
  const statsResponse = await request.get(`/stats/${link.code}`);
  const statsHtml = await statsResponse.text();
  expect(statsHtml).toContain('Stats not found.');
  expect(statsHtml).not.toContain(link.destinationUrl);
  expect((await page.goto(`/${link.code}`))?.status()).toBe(403);
  await expect(
    page.getByRole('heading', { name: 'This link isn’t available.' }),
  ).toBeVisible();
  expect(await page.content()).not.toContain(link.destinationUrl);
  expect(
    (await db.link.findUniqueOrThrow({ where: { id: link.id } })).totalClicks,
  ).toBe(BigInt(0));
});

test('forged forwarded headers cannot bypass the local creation limit', async ({
  request,
}) => {
  const scope = process.env.RATE_LIMIT_SCOPE;
  if (!scope?.startsWith('e2e_'))
    throw new Error('Missing isolated browser quota scope.');
  const [{ now }] = await db.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  // Seed exhaustion so the assertion is stable across a fixed-window boundary.
  await db.rateLimitBucket.upsert({
    where: { key: `${scope}:client:local` },
    create: {
      key: `${scope}:client:local`,
      hits: 10,
      expiresAt: new Date(now.getTime() + 600_000),
    },
    update: { hits: 10, expiresAt: new Date(now.getTime() + 600_000) },
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const destinationUrl = `${destinationOrigin}/${runId}/quota-${attempt}`;
    const response = await request.post('/api/links', {
      data: { url: destinationUrl },
      headers: {
        'x-forwarded-for': `203.0.113.${attempt + 1}`,
        'x-vercel-forwarded-for': `198.51.100.${attempt + 1}`,
      },
    });
    expect(response.status()).toBe(429);
    expect((await response.json()).error.code).toBe('RATE_LIMITED');
    expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(await db.link.count({ where: { destinationUrl } })).toBe(0);
  }
});
