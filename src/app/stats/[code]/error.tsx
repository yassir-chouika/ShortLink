'use client';
import Link from 'next/link';

export default function StatsError({ retry }: { retry: () => void }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-xl px-6 py-24"
    >
      <h1 className="text-3xl font-semibold tracking-tight">
        Stats are temporarily unavailable.
      </h1>
      <p className="mt-5 leading-relaxed text-stone-600">
        We couldn’t load these counts. Please try again shortly.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-6 min-h-11 rounded-lg bg-emerald-900 px-5 py-3 font-semibold text-white"
      >
        Try again
      </button>
      <Link
        href="/"
        className="ml-5 inline-block text-sm font-semibold text-emerald-900 underline underline-offset-4"
      >
        Back to Shrtnr.
      </Link>
    </main>
  );
}
