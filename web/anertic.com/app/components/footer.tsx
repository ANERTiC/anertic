export function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1120px] flex-col items-center gap-4 border-t border-border px-5 py-6 sm:flex-row sm:justify-between sm:px-8 sm:py-7">
      <div className="flex items-center gap-3.5">
        <span className="text-sm font-extrabold text-text-3">
          ANER<span className="text-accent">Ti</span>C
        </span>
        <span className="text-xs text-text-3">
          &copy; 2026 ANERTiC. All rights reserved.
        </span>
      </div>
      <div className="flex gap-5">
        <a
          href="#"
          className="rounded text-xs text-text-3 transition-colors hover:text-text-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Privacy
        </a>
        <a
          href="#"
          className="rounded text-xs text-text-3 transition-colors hover:text-text-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Terms
        </a>
        <a
          href="https://github.com/anertic"
          className="rounded text-xs text-text-3 transition-colors hover:text-text-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
