'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createLinkQrCode, type LinkQrImage } from '@/lib/links/qr-code';

type QrState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; image: LinkQrImage };

function QrPanel({ shortUrl }: { shortUrl: string }) {
  const [state, setState] = useState<QrState>({ status: 'idle' });
  const pending = useRef(false);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (state.status === 'ready') downloadRef.current?.focus();
  }, [state.status]);

  async function generate() {
    if (pending.current) return;
    pending.current = true;
    setState({ status: 'loading' });
    try {
      const image = await createLinkQrCode(shortUrl);
      setState({ status: 'ready', image });
    } catch {
      setState({ status: 'error' });
    } finally {
      pending.current = false;
    }
  }

  return (
    <div className="mt-5 border-t border-emerald-900/15 pt-5">
      {state.status !== 'ready' && (
        <button
          type="button"
          onClick={generate}
          disabled={state.status === 'loading'}
          className="min-h-11 rounded-lg border border-emerald-900/40 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-70"
        >
          {state.status === 'loading'
            ? 'Generating QR code…'
            : state.status === 'error'
              ? 'Try QR code again'
              : 'Show QR code'}
        </button>
      )}
      <p role="status" className="sr-only">
        {state.status === 'loading'
          ? 'Generating your QR code.'
          : state.status === 'ready'
            ? 'QR code ready. You can download the PNG.'
            : ''}
      </p>
      {state.status === 'error' && (
        <p role="alert" className="mt-3 text-sm text-red-900">
          We couldn’t generate the QR code. Your short link still works. Try
          again or copy the link above.
        </p>
      )}
      {state.status === 'ready' && (
        <section
          aria-labelledby="qr-heading"
          className="flex flex-col items-start gap-5 sm:flex-row sm:items-center"
        >
          <Image
            src={state.image.dataUrl}
            alt="QR code for your short link"
            width={192}
            height={192}
            unoptimized
            className="h-48 w-48 max-w-full shrink-0 rounded-lg border border-stone-300 bg-white [image-rendering:pixelated]"
          />
          <div className="min-w-0">
            <h4
              id="qr-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Share with a scan.
            </h4>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-600">
              Scan to open your short link, or download the QR code for
              something you’re sharing.
            </p>
            <a
              ref={downloadRef}
              href={state.image.dataUrl}
              download={state.image.filename}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950"
            >
              Download QR code (PNG)
            </a>
            <p className="mt-2 text-xs text-stone-600">
              512 × 512 PNG · Generated on your device
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

export function LinkQrCode({ shortUrl }: { shortUrl: string }) {
  // A replacement link gets fresh state; late work for the previous one cannot
  // replace its image or download filename.
  return <QrPanel key={shortUrl} shortUrl={shortUrl} />;
}
