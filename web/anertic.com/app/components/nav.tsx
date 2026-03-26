const APP_URL =
  typeof process !== "undefined"
    ? (process.env.APP_URL ?? "https://app.anertic.com")
    : "https://app.anertic.com";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/85 backdrop-blur-2xl">
      <nav className="mx-auto flex max-w-[1120px] items-center justify-between px-8 py-3.5">
        <a href="/" className="text-[17px] font-extrabold tracking-tight">
          ANER<span className="text-accent">Ti</span>C
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13.5px] font-medium text-text-2 transition-colors hover:text-text"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3.5">
          <a
            href={`${APP_URL}/login`}
            className="text-[13.5px] font-medium text-text-2 transition-colors hover:text-text"
          >
            Sign in
          </a>
          <a
            href={APP_URL}
            className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(13,150,104,0.2)] active:scale-[0.97]"
          >
            Get Started
          </a>
        </div>
      </nav>
    </header>
  );
}
