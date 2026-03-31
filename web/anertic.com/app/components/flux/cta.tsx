import { ScrollReveal } from "../scroll-reveal";

const FLUX_URL =
  typeof process !== "undefined"
    ? (process.env.FLUX_URL ?? "https://flux.anertic.com")
    : "https://flux.anertic.com";

const CARDS = [
  {
    audience: "For Homeowners",
    description:
      "Start managing your EV charging for free. Connect any OCPP charger in minutes.",
    cta: "Start Free",
    href: FLUX_URL,
    variant: "primary" as const,
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    audience: "For Business & Fleet",
    description:
      "Multi-site management, billing, fleet optimization. Let's talk about your needs.",
    cta: "Contact Sales",
    href: "#contact",
    variant: "outline" as const,
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M12 12v4M10 14h4" />
      </svg>
    ),
  },
];

export function FluxCta() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
      <ScrollReveal className="text-center">
        <h2 className="text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
          Ready to charge smarter?
        </h2>
        <p className="mx-auto mt-4 max-w-[440px] text-[15px] leading-relaxed text-text-2">
          Whether you're charging one car at home or a fleet of 100, Flux has
          you covered.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={80}>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {CARDS.map((card) => (
            <div
              key={card.audience}
              className={`group relative flex flex-col rounded-2xl border p-8 transition-[transform,box-shadow] duration-300 motion-safe:hover:-translate-y-1 ${
                card.variant === "primary"
                  ? "border-[#3b82f6] bg-[#3b82f6] text-white shadow-[0_4px_24px_rgba(59,130,246,0.12)] hover:shadow-[0_8px_32px_rgba(59,130,246,0.18)]"
                  : "border-border bg-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
              }`}
            >
              {/* Icon badge */}
              <div
                className={`mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] ${
                  card.variant === "primary"
                    ? "bg-white/20"
                    : "bg-[#3b82f6]/[0.07]"
                }`}
              >
                {card.icon}
              </div>

              <h3
                className={`text-[18px] font-extrabold tracking-[-0.025em] ${
                  card.variant === "primary" ? "text-white" : "text-text"
                }`}
              >
                {card.audience}
              </h3>

              <p
                className={`mt-2 flex-1 text-[14px] leading-relaxed ${
                  card.variant === "primary"
                    ? "text-white/80"
                    : "text-text-2"
                }`}
              >
                {card.description}
              </p>

              <a
                href={card.href}
                className={`mt-7 inline-flex items-center self-start rounded-[10px] px-6 py-2.5 text-sm font-semibold transition-[transform,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] ${
                  card.variant === "primary"
                    ? "bg-white text-[#3b82f6] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] focus-visible:ring-white"
                    : "border border-[#3b82f6] text-[#3b82f6] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(59,130,246,0.12)] focus-visible:ring-[#3b82f6]"
                }`}
              >
                {card.cta}
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-1.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
