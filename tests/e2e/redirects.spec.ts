import { expect, test } from '@playwright/test';

test('malformed short codes return an uncached 404 without a database', async ({
  request,
}) => {
  const response = await request.get('/invalid.code');
  expect(response.status()).toBe(404);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect((await response.json()).error.code).toBe('LINK_NOT_FOUND');
});

test('HEAD errors have no response body', async ({ request }) => {
  const response = await request.head('/bad');
  expect(response.status()).toBe(404);
  expect(await response.text()).toBe('');
});

test('short-code routes reject POST requests', async ({ request }) => {
  const response = await request.post('/Ab12_cd3', { data: {} });
  expect(response.status()).toBe(405);
});
