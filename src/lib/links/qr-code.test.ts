import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLinkQrCode } from './qr-code';

const { encode } = vi.hoisted(() => ({
  encode: vi.fn<(...args: unknown[]) => Promise<string>>(),
}));
vi.mock('qrcode', () => ({ toDataURL: encode }));
afterEach(() => vi.resetAllMocks());

describe('short-link QR encoding', () => {
  it('encodes the exact short URL with a white quiet zone and PNG output', async () => {
    encode.mockResolvedValue('data:image/png;base64,example');
    const url = 'https://preview.example:8443/Ab12_cd3';
    expect(await createLinkQrCode(url)).toEqual({
      dataUrl: 'data:image/png;base64,example',
      filename: 'shrtnr-Ab12_cd3.png',
    });
    expect(encode).toHaveBeenCalledExactlyOnceWith(url, {
      type: 'image/png',
      width: 512,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    });
  });

  it.each([
    'javascript:alert(1)',
    'https://example.com/long/path',
    'https://example.com/Ab12_cd3?extra=1',
    'https://example.com/Ab12_cd3#section',
    'https://user:secret@example.com/Ab12_cd3',
    'not a url',
  ])('rejects a value that is not a generated short URL: %s', async (url) => {
    await expect(createLinkQrCode(url)).rejects.toThrow();
    expect(encode).not.toHaveBeenCalled();
  });
});
