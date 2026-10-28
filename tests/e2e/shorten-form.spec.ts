import { expect, test } from '@playwright/test';

test('keyboard submission announces validation and focuses the invalid input', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your long link' });
  await input.fill('javascript:alert(1)');
  await input.press('Enter');
  await expect(
    page.getByRole('form', { name: 'Shorten a link' }).getByRole('alert'),
  ).toContainText('Enter a complete');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await input.fill('https://example.com');
  await expect(
    page.getByRole('form', { name: 'Shorten a link' }).getByRole('alert'),
  ).toHaveCount(0);
});

test('shows pending feedback and presents the returned link without mobile overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let requests = 0;
  await page.route('**/api/links', async (route) => {
    requests++;
    await pending;
    await route.fulfill({
      status: 201,
      json: {
        data: {
          code: 'Ab12_cd3',
          destinationUrl: `https://example.com/${'a'.repeat(1800)}`,
        },
      },
    });
  });
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Your long link' })
    .fill('https://example.com');
  await page.getByRole('button', { name: 'Shorten link' }).click();
  await expect(
    page.getByRole('button', { name: 'Shortening…' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('textbox', { name: 'Your long link' }),
  ).not.toBeEditable();
  finish();
  await expect(
    page.getByRole('region', { name: 'Your short link is ready.' }),
  ).toBeFocused();
  await expect(
    page.getByRole('textbox', { name: 'Your short link' }),
  ).toHaveValue('http://127.0.0.1:3000/Ab12_cd3');
  expect(requests).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});

test('clipboard denial keeps the link available and selected', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Denied')) },
    });
  });
  await page.route('**/api/links', (route) =>
    route.fulfill({
      status: 201,
      json: {
        data: { code: 'Ab12_cd3', destinationUrl: 'https://example.com/' },
      },
    }),
  );
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Your long link' })
    .fill('https://example.com');
  await page.getByRole('button', { name: 'Shorten link' }).click();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(
    page.getByText(/Automatic copying is unavailable/),
  ).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Your short link' });
  await expect(input).toBeFocused();
  expect(
    await input.evaluate(
      (element: HTMLInputElement) =>
        element.selectionEnd! - element.selectionStart!,
    ),
  ).toBe('http://127.0.0.1:3000/Ab12_cd3'.length);
});

test('a server error keeps the destination and permits an explicit retry', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/links', (route) => {
    requests++;
    return route.fulfill(
      requests === 1
        ? {
            status: 503,
            json: { error: { message: 'private backend details' } },
          }
        : {
            status: 201,
            json: {
              data: {
                code: 'Ab12_cd3',
                destinationUrl: 'https://example.com/',
              },
            },
          },
    );
  });
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Your long link' })
    .fill('https://example.com');
  await page.getByRole('button', { name: 'Shorten link' }).click();
  await expect(
    page.getByRole('form', { name: 'Shorten a link' }).getByRole('alert'),
  ).toContainText('temporarily unavailable');
  await expect(page.getByText('private backend details')).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Your long link' }),
  ).toHaveValue('https://example.com');
  await page.getByRole('button', { name: 'Shorten link' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Your short link' }),
  ).toBeVisible();
  expect(requests).toBe(2);
});
