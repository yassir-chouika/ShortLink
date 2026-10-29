import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLinkQrCode } from '@/lib/links/qr-code';
import { LinkQrCode } from './link-qr-code';

vi.mock('@/lib/links/qr-code', () => ({ createLinkQrCode: vi.fn() }));
const shortUrl = 'https://short.example/Ab12_cd3';
const image = {
  dataUrl: 'data:image/png;base64,aGVsbG8=',
  filename: 'shrtnr-Ab12_cd3.png',
};
afterEach(() => vi.resetAllMocks());

describe('LinkQrCode', () => {
  it('waits for an explicit request before generating an image', () => {
    render(<LinkQrCode shortUrl={shortUrl} />);
    expect(screen.getByRole('button', { name: 'Show QR code' })).toBeEnabled();
    expect(createLinkQrCode).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('generates the short URL and focuses a named PNG download', async () => {
    vi.mocked(createLinkQrCode).mockResolvedValue(image);
    render(<LinkQrCode shortUrl={shortUrl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show QR code' }));
    const download = await screen.findByRole('link', {
      name: 'Download QR code (PNG)',
    });
    expect(createLinkQrCode).toHaveBeenCalledExactlyOnceWith(shortUrl);
    expect(
      screen.getByRole('img', { name: 'QR code for your short link' }),
    ).toHaveAttribute('src', image.dataUrl);
    expect(download).toHaveAttribute('href', image.dataUrl);
    expect(download).toHaveAttribute('download', image.filename);
    expect(download).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('QR code ready');
  });

  it('prevents duplicate generation while pending', async () => {
    let finish!: (value: typeof image) => void;
    vi.mocked(createLinkQrCode).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<LinkQrCode shortUrl={shortUrl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show QR code' }));
    const pending = screen.getByRole('button', { name: 'Generating QR code…' });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(createLinkQrCode).toHaveBeenCalledTimes(1);
    await act(async () => finish(image));
    expect(
      screen.getByRole('link', { name: /Download QR code/ }),
    ).toBeVisible();
  });

  it('presents a safe error and retries only generation', async () => {
    vi.mocked(createLinkQrCode)
      .mockRejectedValueOnce(new Error('private URL detail'))
      .mockResolvedValueOnce(image);
    render(<LinkQrCode shortUrl={shortUrl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show QR code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your short link still works',
    );
    expect(screen.queryByText('private URL detail')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try QR code again' }));
    expect(
      await screen.findByRole('link', { name: /Download QR code/ }),
    ).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cannot attach a late result to a replacement short link', async () => {
    let finish!: (value: typeof image) => void;
    vi.mocked(createLinkQrCode).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { rerender } = render(<LinkQrCode shortUrl={shortUrl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show QR code' }));
    rerender(<LinkQrCode shortUrl="https://short.example/Xy98_ab7" />);
    await act(async () => finish(image));
    expect(
      screen.queryByRole('link', { name: /Download QR code/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show QR code' })).toBeEnabled();
  });
});
