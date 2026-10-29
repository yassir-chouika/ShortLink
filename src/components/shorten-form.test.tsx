import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShortenForm } from './shorten-form';

const fetchMock = vi.fn<typeof fetch>();
const destination = 'https://example.com/article?saved=1#details';
const payload = { data: { code: 'Ab12_cd3', destinationUrl: destination } };

function fill(value = destination) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Your long link' }), {
    target: { value },
  });
}

function submit() {
  fireEvent.submit(screen.getByRole('form', { name: 'Shorten a link' }));
}

function setup() {
  vi.stubGlobal('fetch', fetchMock);
  render(<ShortenForm />);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe('ShortenForm', () => {
  it.each([
    ['', 'Paste the link'],
    ['example.com', 'Enter a complete'],
    ['javascript:alert(1)', 'Enter a complete'],
    ['https://user:secret@example.com', 'Enter a complete'],
    ['https://example.com/has space', 'Enter a complete'],
    [`https://example.com/${'x'.repeat(2048)}`, '2,048 characters'],
    [`https://example.com/${'é'.repeat(400)}`, 'Enter a complete'],
  ])('rejects invalid input locally: %s', (value, message) => {
    setup();
    fill(value);
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(
      screen.getByRole('textbox', { name: 'Your long link' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('textbox', { name: 'Your long link' }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the normalized destination, uses the current origin, and focuses the result', async () => {
    setup();
    fetchMock.mockResolvedValue(Response.json(payload, { status: 201 }));
    fill('  HTTPS://EXAMPLE.COM:443/article?saved=1#details  ');
    submit();

    const result = await screen.findByRole('region', {
      name: 'Your short link is ready.',
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: destination }),
      cache: 'no-store',
    });
    expect(
      screen.getByRole('textbox', { name: 'Your short link' }),
    ).toHaveValue(`${window.location.origin}/Ab12_cd3`);
    expect(result).toHaveFocus();
    expect(screen.getByRole('link', { name: /Open link/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('prevents concurrent submissions and keeps the submitted destination fixed', async () => {
    setup();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    fill();
    submit();
    submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Shortening…' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'Your long link' }),
    ).toHaveAttribute('readonly');
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      resolve(Response.json(payload, { status: 201 }));
    });
    expect(screen.getByRole('button', { name: 'Shorten link' })).toBeEnabled();
  });

  it.each([
    [400, 'Enter a complete', true],
    [403, 'This destination cannot be shortened', true],
    [413, 'Enter a complete', true],
    [429, 'Link creation limit reached', false],
    [503, 'temporarily unavailable', false],
    [500, 'temporarily unavailable', false],
  ])('presents a safe error for HTTP %i', async (status, message, invalid) => {
    setup();
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { message: 'private database secret' } },
        { status },
      ),
    );
    fill();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(
      screen.queryByText(/private database secret/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your long link' })).toHaveValue(
      destination,
    );
    expect(
      screen.getByRole('textbox', { name: 'Your long link' }),
    ).toHaveAttribute(
      'aria-describedby',
      invalid ? 'url-hint form-error' : 'url-hint',
    );
    expect(screen.getByRole('button', { name: 'Shorten link' })).toBeEnabled();
  });

  it('clears a field error when editing and permits a corrected submission', async () => {
    setup();
    submit();
    fill();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fetchMock.mockResolvedValue(Response.json(payload, { status: 201 }));
    submit();
    expect(
      await screen.findByRole('textbox', { name: 'Your short link' }),
    ).toBeVisible();
    fill('https://example.com/another');
    expect(
      screen.queryByRole('textbox', { name: 'Your short link' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['90', 'about 2 minutes'],
    ['7200', 'about 2 hours'],
    ['invalid', 'Please try again later'],
    ['-10', 'Please try again later'],
    ['99999999', 'Please try again later'],
  ])(
    'presents a bounded Retry-After value: %s',
    async (retryAfter, message) => {
      setup();
      fetchMock.mockResolvedValue(
        Response.json(
          {},
          { status: 429, headers: { 'Retry-After': retryAfter } },
        ),
      );
      fill();
      submit();
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('handles a lost response without automatically retrying the write', async () => {
    setup();
    fetchMock.mockRejectedValue(new TypeError('Network disconnected'));
    fill();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'couldn’t confirm',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Shorten link' })).toBeEnabled();
  });

  it.each([
    null,
    { data: { code: '//evil.test', destinationUrl: destination } },
    { data: { code: 'Ab12_cd3', destinationUrl: 'javascript:alert(1)' } },
    { data: { code: 'Ab12_cd3' } },
  ])(
    'does not render a link from a malformed success response: %j',
    async (body) => {
      setup();
      fetchMock.mockResolvedValue(Response.json(body, { status: 201 }));
      fill();
      submit();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'couldn’t confirm',
      );
      expect(
        screen.queryByRole('link', { name: /Open link/ }),
      ).not.toBeInTheDocument();
    },
  );

  it('copies the current-origin link and announces success', async () => {
    setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    fetchMock.mockResolvedValue(Response.json(payload, { status: 201 }));
    fill();
    submit();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/Ab12_cd3`,
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Copied!' }),
    ).toBeEnabled();
    expect(screen.getByText('Link copied to your clipboard.')).toHaveAttribute(
      'role',
      'status',
    );
  });

  it.each(['denied', 'missing'])(
    'selects the link for manual copying when clipboard is %s',
    async (reason) => {
      setup();
      vi.stubGlobal(
        'navigator',
        reason === 'denied'
          ? {
              clipboard: {
                writeText: vi.fn().mockRejectedValue(new Error('Denied')),
              },
            }
          : {},
      );
      fetchMock.mockResolvedValue(Response.json(payload, { status: 201 }));
      fill();
      submit();
      fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
      expect(
        await screen.findByText(/Automatic copying is unavailable/),
      ).toBeVisible();
      const input = screen.getByRole('textbox', {
        name: 'Your short link',
      }) as HTMLInputElement;
      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    },
  );
});
