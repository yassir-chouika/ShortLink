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

test('a missing link has a styled accessible browser page at its original URL', async ({
  page,
}) => {
  const response = await page.goto(
    '/invalid.code?privateMarker=do-not-reflect',
  );
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL('/invalid.code?privateMarker=do-not-reflect');
  await expect(
    page.getByRole('heading', { name: 'This link is missing.' }),
  ).toBeVisible();
  await expect(page).toHaveTitle('This link is missing. | Shrtnr.');
  expect(
    await page
      .locator('html')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe('rgb(250, 250, 247)');
  expect(await page.content()).not.toContain('do-not-reflect');
  expect(response?.headers()['content-security-policy']).toContain(
    "style-src 'sha256-",
  );
  const vary = (await response!.headerValues('vary')).join(',');
  expect(
    vary
      .toLowerCase()
      .split(',')
      .map((value) => value.trim()),
  ).toContain('accept');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('link', { name: /Back to Shrtnr/ }).click();
  await expect(page).toHaveURL('/');
});

test('the unavailable page works without JavaScript and retries the same URL', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 812 },
  });
  try {
    const page = await context.newPage();
    const response = await page.goto('/Ab12_cd3');
    expect(response?.status()).toBe(503);
    await expect(
      page.getByRole('heading', { name: 'A short pause.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await Promise.all([
      page.waitForResponse(
        (reply) =>
          reply.url().endsWith('/Ab12_cd3') &&
          reply.request().isNavigationRequest(),
      ),
      page.getByRole('link', { name: 'Try again' }).click(),
    ]);
    await expect(page).toHaveURL('/Ab12_cd3');
    await expect(
      page.getByRole('heading', { name: 'A short pause.' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test('HEAD negotiates the HTML error headers while keeping the body empty', async ({
  request,
}) => {
  const response = await request.head('/bad', {
    headers: { Accept: 'text/html' },
  });
  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('text/html');
  expect(await response.text()).toBe('');
});
