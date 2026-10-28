import Link from 'next/link';
import { ShortenForm } from '@/components/shorten-form';

const steps = [
  [
    '01',
    'Bring your long link.',
    'An article, a project, a very specific corner of the internet.',
  ],
  [
    '02',
    'Make a little space.',
    'We give it a short link that leads to the same destination.',
  ],
  [
    '03',
    'Pass it along.',
    'Copy your new link and share it wherever the conversation goes.',
  ],
];

export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-5 sm:px-10">
      <header className="flex items-center justify-between border-b border-stone-300/80 py-6 sm:py-8">
        <Link
          href="/"
          aria-label="Shrtnr. home"
          className="text-3xl font-bold tracking-tighter"
        >
          Shrtnr<span className="text-emerald-800">.</span>
        </Link>
        <a
          href="#how-it-works"
          className="text-sm font-medium text-stone-600 underline-offset-4 hover:underline"
        >
          How it works <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 pt-14 pb-16 sm:pt-20 sm:pb-24"
      >
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_auto] lg:gap-12">
          <div>
            <p className="mb-5 flex items-center gap-2 font-mono text-xs tracking-wide text-emerald-900 sm:text-sm">
              <span
                className="h-2 w-2 rounded-full bg-emerald-800"
                aria-hidden="true"
              />
              A little less link. A little more possibility.
            </p>
            <h1 className="max-w-3xl text-5xl leading-[1.06] font-semibold tracking-[-0.055em] text-balance sm:text-7xl">
              Good things come in{' '}
              <span className="text-emerald-800">short links.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-stone-600">
              Long URL? Let’s make it a little easier to share. Paste your link
              below and give it a shorter way to get there.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="hidden rotate-3 border border-emerald-900/20 bg-[#e6ecdf] px-6 py-5 font-mono text-sm text-emerald-950 lg:mt-9 lg:block"
          >
            <p className="text-xs tracking-widest">LESS IS A LINK.</p>
            <p className="mt-6 text-stone-500 line-through decoration-stone-400">
              https://…/a/very/long/link
            </p>
            <p className="mt-2 text-2xl">↳ short & sweet.</p>
          </div>
        </div>

        <div className="mt-10 sm:mt-12">
          <ShortenForm />
        </div>

        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="mt-16 scroll-mt-8 sm:mt-20"
        >
          <div className="mb-7 flex items-center gap-4">
            <h2
              id="how-heading"
              className="shrink-0 font-mono text-xs font-medium tracking-widest text-stone-600 uppercase"
            >
              A shorter route to sharing
            </h2>
            <div className="h-px flex-1 bg-stone-300" aria-hidden="true" />
          </div>
          <ol className="grid gap-7 sm:grid-cols-3 sm:gap-8">
            {steps.map(([number, title, description]) => (
              <li key={number}>
                <span className="font-mono text-xs text-emerald-800">
                  {number} /
                </span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-600">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-300 py-6 text-xs text-stone-600 sm:text-sm">
        <p>Small links. Thoughtfully made.</p>
        <p className="font-mono text-xs">Less to send. More to say.</p>
      </footer>
    </div>
  );
}
