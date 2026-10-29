export type LinkQrImage = { dataUrl: string; filename: string };

/** Encode a generated short URL in the browser without contacting a QR service. */
export async function createLinkQrCode(shortUrl: string): Promise<LinkQrImage> {
  const url = new URL(shortUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/[A-Za-z0-9_-]{8}$/.test(url.pathname)
  ) {
    throw new Error('A generated short URL is required.');
  }
  // Keep the encoder out of the initial form bundle; load it on explicit demand.
  const { toDataURL } = await import('qrcode');
  const dataUrl = await toDataURL(shortUrl, {
    type: 'image/png',
    width: 512,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
  return { dataUrl, filename: `shrtnr-${url.pathname.slice(1)}.png` };
}
