export function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1120px] items-center justify-between border-t border-border px-8 py-7">
      <div className="flex items-center gap-3.5">
        <span className="text-sm font-extrabold text-text-3">ANERTiC</span>
        <span className="text-xs text-text-3">
          2026 ANERTiC. All rights reserved.
        </span>
      </div>
      <div className="flex gap-5">
        <a href="#" className="text-xs text-text-3 transition-colors hover:text-text-2">
          Privacy
        </a>
        <a href="#" className="text-xs text-text-3 transition-colors hover:text-text-2">
          Terms
        </a>
        <a href="https://github.com/anertic" className="text-xs text-text-3 transition-colors hover:text-text-2">
          GitHub
        </a>
      </div>
    </footer>
  )
}
