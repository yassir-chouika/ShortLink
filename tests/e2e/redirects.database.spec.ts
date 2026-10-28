import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { getTestDatabaseUrl } from '../helpers/test-database-url';

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
}) => {
  const destination = `${destinationOrigin}/${runId}/head`;
  const code = await createViaApi(request, destination);
  const response = await request.head(`/${code}`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
  expect(await response.text()).toBe('');
});

test('a deleted link returns 404 rather than a cached redirect', async ({
  request,
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
