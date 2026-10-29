import jsQR from 'jsqr';
import type { Page } from '@playwright/test';

/** Decode PNG pixels with an independent reader, not the generation library. */
export async function decodeQrPng(
  page: Page,
  bytes: number[],
): Promise<string | null> {
  const pixels = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(data)], { type: 'image/png' }),
    );
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Missing test canvas context.');
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      // Transfer packed pixels rather than serializing a million JSON numbers.
      let binary = '';
      for (let offset = 0; offset < data.length; offset += 32768) {
        binary += String.fromCharCode(...data.subarray(offset, offset + 32768));
      }
      return {
        data: btoa(binary),
        width: bitmap.width,
        height: bitmap.height,
      };
    } finally {
      bitmap.close();
    }
  }, bytes);
  return (
    jsQR(
      new Uint8ClampedArray(Buffer.from(pixels.data, 'base64')),
      pixels.width,
      pixels.height,
    )?.data ?? null
  );
}
