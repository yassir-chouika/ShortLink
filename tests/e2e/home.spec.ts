import { expect, test } from '@playwright/test';

test('home has metadata and supports keyboard navigation to main content', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Shrtnr. | Short links, simply');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Good things come in short links.',
  );

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('home fits a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  await expect(page.getByText('Coming soon')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
