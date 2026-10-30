import Link from 'next/link';

export default function StatsNotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-xl px-6 py-24"
    >
      <h1 className="text-3xl font-semibold tracking-tight">
        Stats not found.
      </h1>
      <p className="mt-5 leading-relaxed text-stone-600">
        This link may be missing or unavailable. Check the short code and try
        again.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block font-semibold text-emerald-900 underline underline-offset-4"
      >
        Back to Shrtnr.
      </Link>
    </main>
  );
}
