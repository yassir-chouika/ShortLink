import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { decodeQrPng } from '../helpers/decode-qr';

test('generates a decodable QR and downloads a PNG without another creation request', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 812 });
  let creations = 0;
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:3000')
      externalRequests.push(request.url());
  });
  await page.route('**/api/links', (route) => {
    creations++;
    return route.fulfill({
      status: 201,
      json: {
        data: {
          code: 'Ab12_cd3',
          destinationUrl: 'https://example.com/a-long-destination',
        },
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Show QR code' })).toHaveCount(
    0,
  );
  await page
    .getByRole('textbox', { name: 'Your long link' })
    .fill('https://example.com/a-long-destination');
  await page.getByRole('button', { name: 'Shorten link' }).click();
  await page.getByRole('button', { name: 'Show QR code' }).click();
  const image = page.getByRole('img', { name: 'QR code for your short link' });
  await expect(image).toBeVisible();
  const downloadLink = page.getByRole('link', {
    name: 'Download QR code (PNG)',
  });
  await expect(downloadLink).toBeFocused();
  const src = await image.getAttribute('src');
  expect(src).toMatch(/^data:image\/png;base64,/);
  expect(await decodeQrPng(page, Array.from(await image.screenshot()))).toBe(
    'http://127.0.0.1:3000/Ab12_cd3',
  );
  expect(
    await decodeQrPng(
      page,
      Array.from(Buffer.from(src!.split(',')[1], 'base64')),
    ),
  ).toBe('http://127.0.0.1:3000/Ab12_cd3');
  expect(
    await image.evaluate((element: HTMLImageElement) => ({
      width: element.naturalWidth,
      height: element.naturalHeight,
    })),
  ).toEqual({ width: 512, height: 512 });
  const downloaded = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('shrtnr-Ab12_cd3.png');
  const path = testInfo.outputPath('short-link-qr.png');
  await download.saveAs(path);
  const bytes = await readFile(path);
  expect(Array.from(bytes.subarray(0, 8))).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  expect(await decodeQrPng(page, Array.from(bytes))).toBe(
    'http://127.0.0.1:3000/Ab12_cd3',
  );
  expect(creations).toBe(1);
  expect(externalRequests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page
    .getByRole('textbox', { name: 'Your long link' })
    .fill('https://example.com/new');
  await expect(image).toHaveCount(0);
  await expect(downloadLink).toHaveCount(0);
});
