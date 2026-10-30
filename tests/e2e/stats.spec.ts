import { expect, test } from '@playwright/test';

test('malformed stats codes show a useful missing-link page without database access', async ({
  page,
}) => {
  await page.goto('/stats/bad');
  await expect(
    page.getByRole('heading', { name: 'Stats not found.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Back to Shrtnr.' }),
  ).toHaveAttribute('href', '/');
});

test('stats storage errors show a safe retry screen and prevent indexing', async ({
  page,
}) => {
  const response = await page.goto('/stats/Ab12_cd3');
  await expect(
    page.getByRole('heading', { name: 'Stats are temporarily unavailable.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page.getByText(/postgresql:\/\//)).toHaveCount(0);
});
