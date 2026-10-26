export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between py-8">
        <span className="text-2xl font-bold tracking-tight">
          Shrtnr<span className="text-emerald-700">.</span>
        </span>
        <span className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600">
          Coming soon
        </span>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center py-16 sm:py-24"
      >
        <div className="max-w-3xl">
          <p className="mb-6 text-sm font-semibold tracking-wide text-emerald-800">
            A little less link. A little more possibility.
          </p>
          <h1 className="text-5xl leading-tight font-semibold tracking-tight text-balance sm:text-7xl">
            Good things come in short links.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-pretty text-stone-600">
            A simpler way to shorten, share, and understand your links is on its
            way.
          </p>
        </div>
      </main>

      <footer className="border-t border-stone-300 py-6 text-sm text-stone-600">
        Small links. Thoughtfully made.
      </footer>
    </div>
  );
}
