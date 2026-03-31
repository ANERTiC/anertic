import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";

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

const PRODUCTS = [
  {
    label: "ANERTiC",
    href: "/",
    description: "AI for your energy",
    accent: "#0d9668",
    icon: (
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0d9668"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    label: "Flux",
    href: "/chargers",
    description: "EV Charging Platform",
    accent: "#3b82f6",
    icon: (
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/85 backdrop-blur-2xl">
      <nav className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="/" className="text-[17px] font-extrabold tracking-tight">
          ANER<span className="text-accent">Ti</span>C
        </a>

        <div className="hidden items-center gap-7 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md text-[13.5px] font-medium text-text-2 transition-colors hover:text-text focus-visible:outline-none">
              Products
              <ChevronDownIcon className="size-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-[260px] rounded-xl p-1.5">
              <DropdownMenuGroup>
                {PRODUCTS.map((product) => (
                  <DropdownMenuItem key={product.href} asChild className="focus:bg-[#f5f5f5] focus:text-text">
                    <a
                      href={product.href}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5"
                    >
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${product.accent}12` }}
                      >
                        {product.icon}
                      </div>
                      <div>
                        <p className="text-[13.5px] font-semibold text-text">
                          {product.label}
                        </p>
                        <p className="text-[12px] text-text-3">
                          {product.description}
                        </p>
                      </div>
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md text-[13.5px] font-medium text-text-2 transition-colors hover:text-text focus-visible:outline-none"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <a
            href={`${APP_URL}/login`}
            className="hidden rounded-md px-3 py-2 text-[13.5px] font-medium text-text-2 transition-colors hover:text-text focus-visible:outline-none sm:block"
          >
            Sign in
          </a>
          <a
            href={APP_URL}
            className="rounded-[10px] bg-accent px-5 py-2 text-[13px] font-semibold text-white transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(13,150,104,0.2)] focus-visible:outline-none active:scale-[0.97]"
          >
            Start Free
          </a>
        </div>
      </nav>
    </header>
  );
}
