'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  MAX_DESTINATION_LENGTH,
  validateDestinationUrl,
} from '@/lib/links/validation';

type CreatedLink = { shortUrl: string; destinationUrl: string };
type FormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string; field: boolean }
  | { status: 'success'; link: CreatedLink };

const INVALID_URL_MESSAGE =
  'Enter a complete http:// or https:// link without spaces, a username, or a password.';

function rateLimitMessage(response: Response): string {
  const seconds = Number(response.headers.get('Retry-After'));
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400) {
    return 'Link creation limit reached. Please try again later.';
  }
  const unit = seconds >= 3600 ? 'hour' : 'minute';
  const amount = Math.ceil(seconds / (unit === 'hour' ? 3600 : 60));
  return `Link creation limit reached. Try again in about ${amount} ${unit}${amount === 1 ? '' : 's'}.`;
}

function readCreatedLink(payload: unknown): CreatedLink {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new Error('Invalid response.');
  }
  const data = payload.data;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('code' in data) ||
    typeof data.code !== 'string' ||
    !/^[A-Za-z0-9_-]{8}$/.test(data.code) ||
    !('destinationUrl' in data)
  ) {
    throw new Error('Invalid response.');
  }
  return {
    // Use the page's origin, never a server-provided host or forwarded header.
    shortUrl: new URL(`/${data.code}`, window.location.origin).href,
    destinationUrl: validateDestinationUrl(data.destinationUrl),
  };
}

function LinkResult({ shortUrl, destinationUrl }: CreatedLink) {
  const [copy, setCopy] = useState<'ready' | 'copying' | 'copied' | 'manual'>(
    'ready',
  );
  const resultRef = useRef<HTMLElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    resultRef.current?.focus();
  }, []);

  async function copyLink() {
    setCopy('copying');
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopy('copied');
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setCopy('manual');
    }
  }

  return (
    <section
      ref={resultRef}
      tabIndex={-1}
      aria-labelledby="result-heading"
      className="mt-6 min-w-0 rounded-xl border border-emerald-800/25 bg-[#edf2e8] p-5 sm:p-6"
    >
      <p className="mb-2 font-mono text-xs text-emerald-900">
        LESS LINK. SAME DESTINATION.
      </p>
      <h3 id="result-heading" className="text-xl font-semibold tracking-tight">
        Your short link is ready.
      </h3>
      <label htmlFor="short-url" className="sr-only">
        Your short link
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          ref={linkRef}
          id="short-url"
          readOnly
          value={shortUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-emerald-900/25 bg-white px-4 py-3 font-mono text-sm"
        />
        <button
          type="button"
          onClick={copyLink}
          disabled={copy === 'copying'}
          className="rounded-lg bg-emerald-900 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-950 disabled:cursor-wait disabled:opacity-70"
        >
          {copy === 'copied'
            ? 'Copied!'
            : copy === 'copying'
              ? 'Copying…'
              : 'Copy link'}
        </button>
      </div>
      <p role="status" className="mt-3 text-sm text-emerald-950">
        {copy === 'copied'
          ? 'Link copied to your clipboard.'
          : copy === 'manual'
            ? 'Automatic copying is unavailable. Your link is selected; use your device’s copy command.'
            : ''}
      </p>
      <div className="mt-3 flex flex-col items-start gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 break-all leading-relaxed text-stone-600">
          <span className="font-medium text-stone-800">Destination: </span>
          {destinationUrl}
        </p>
        <a
          href={shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-semibold text-emerald-900 underline underline-offset-4"
        >
          Open link <span className="sr-only">(opens in a new tab)</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}

export function ShortenForm() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<FormState>({ status: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const pending = state.status === 'submitting';
  const fieldError = state.status === 'error' && state.field;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    let destinationUrl: string;
    try {
      destinationUrl = validateDestinationUrl(url);
    } catch {
      const message = !url.trim()
        ? 'Paste the link you’d like to shorten.'
        : url.trim().length > MAX_DESTINATION_LENGTH
          ? `Keep your link within ${MAX_DESTINATION_LENGTH.toLocaleString('en-US')} characters.`
          : INVALID_URL_MESSAGE;
      setState({ status: 'error', message, field: true });
      inputRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setState({ status: 'submitting' });
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: destinationUrl }),
        cache: 'no-store',
      });
      if (!response.ok) {
        const field = [400, 403, 413].includes(response.status);
        const message =
          response.status === 403
            ? 'This destination cannot be shortened. Please use another link.'
            : field
              ? INVALID_URL_MESSAGE
              : response.status === 429
                ? rateLimitMessage(response)
                : 'Link creation is temporarily unavailable. Please try again later.';
        setState({ status: 'error', message, field });
        if (field) inputRef.current?.focus();
        return;
      }
      setState({
        status: 'success',
        link: readCreatedLink(await response.json()),
      });
    } catch {
      // A lost response does not prove the POST failed; never retry automatically.
      setState({
        status: 'error',
        field: false,
        message:
          'We couldn’t confirm your link was created. Check your connection before trying again.',
      });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <section
      aria-labelledby="shorten-heading"
      className="rounded-2xl border border-stone-300 bg-white p-5 shadow-[0_6px_0_0_#e9e9e1] sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="shorten-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Give your link a little room.
        </h2>
        <span className="font-mono text-xs text-stone-500">
          PASTE. SHORTEN. SHARE.
        </span>
      </div>
      <form
        onSubmit={submit}
        noValidate
        aria-label="Shorten a link"
        aria-busy={pending}
      >
        <label
          htmlFor="destination-url"
          className="mb-2 block text-sm font-semibold"
        >
          Your long link
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            ref={inputRef}
            id="destination-url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            required
            readOnly={pending}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setState({ status: 'idle' });
            }}
            aria-invalid={fieldError || undefined}
            aria-describedby={fieldError ? 'url-hint form-error' : 'url-hint'}
            placeholder="https://example.com/something-worth-sharing"
            className="min-w-0 flex-1 rounded-lg border border-stone-400 bg-stone-50/50 px-4 py-3.5 text-base placeholder:text-stone-500 aria-invalid:border-red-700 read-only:text-stone-600"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-12 items-center justify-center gap-5 rounded-lg bg-emerald-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-emerald-950 disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? 'Shortening…' : 'Shorten link'}
            <span aria-hidden="true">{pending ? '···' : '↗'}</span>
          </button>
        </div>
        <p
          id="url-hint"
          className="mt-3 text-xs leading-relaxed text-stone-600"
        >
          Use a public http:// or https:// link. Anyone with your short link can
          open its destination.
        </p>
        {state.status === 'error' && (
          <p
            id="form-error"
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-900"
          >
            {state.message}
          </p>
        )}
      </form>
      <p role="status" className="sr-only">
        {pending ? 'Creating your short link. Please wait.' : ''}
      </p>
      {state.status === 'success' && <LinkResult {...state.link} />}
      <noscript>
        <p className="mt-4 text-sm text-stone-700">
          Enable JavaScript to shorten and copy links.
        </p>
      </noscript>
    </section>
  );
}
