import { expect, test } from '@playwright/test';

test('link creation rejects invalid URLs through the production HTTP route', async ({
  request,
}) => {
  const response = await request.post('/api/links', {
    data: { url: 'javascript:alert(1)' },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error.code).toBe('INVALID_URL');
  expect(response.headers()['cache-control']).toBe('no-store');
});

test('link creation requires JSON through the production HTTP route', async ({
  request,
}) => {
  const response = await request.post('/api/links', {
    data: 'plain text',
    headers: { 'Content-Type': 'text/plain' },
  });
  expect(response.status()).toBe(415);
});

test('the creation endpoint does not expose a GET collection', async ({
  request,
}) => {
  const response = await request.get('/api/links');
  expect(response.status()).toBe(405);
});

test('configured blocked destinations are rejected before database access', async ({
  request,
}) => {
  const response = await request.post('/api/links', {
    data: { url: 'https://sub.blocked.example/path' },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe('DESTINATION_BLOCKED');
  expect(response.headers()['cache-control']).toBe('no-store');
});
