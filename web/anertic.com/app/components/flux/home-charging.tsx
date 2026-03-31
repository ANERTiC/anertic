import { ScrollReveal } from "../scroll-reveal";

const FLUX_URL =
  typeof process !== "undefined"
    ? (process.env.FLUX_URL ?? "https://flux.anertic.com")
    : "https://flux.anertic.com";

const FEATURES = [
  {
    title: "Solar-Aware Charging",
    description:
      "Charge when your panels are producing. Flux syncs with your solar inverter to maximize free energy.",
    iconBg: "bg-blue-500/[0.07]",
    iconColor: "#3b82f6",
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
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    title: "Off-Peak Scheduling",
    description:
      "Automatically shift charging to the cheapest electricity rates. Set it once, save every night.",
    iconBg: "bg-indigo-500/[0.07]",
    iconColor: "#6366f1",
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6366f1"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    title: "Home Load Balancing",
    description:
      "Prevent breaker trips. Flux dynamically adjusts charging power based on your home's total consumption.",
    iconBg: "bg-cyan-500/[0.07]",
    iconColor: "#06b6d4",
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#06b6d4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3L2 9h10V3zM12 3l10 6H12V3z" />
        <path d="M7 21v-6M12 21v-6M17 21v-6M5 21h14" />
        <line x1="2" y1="9" x2="22" y2="9" />
      </svg>
    ),
  },
  {
    title: "Session Monitoring",
    description:
      "Real-time kWh, cost, and duration for every charge. Full history at your fingertips.",
    iconBg: "bg-violet-500/[0.07]",
    iconColor: "#8b5cf6",
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8b5cf6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

export function HomeCharging() {
  return (
    <section
      id="home-charging"
      className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24"
    >
      <ScrollReveal>
        <p className="text-xs font-bold tracking-[0.08em] text-[#3b82f6]">
          FOR HOMEOWNERS
        </p>
        <div className="mt-2.5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
              Charge smarter, not harder
            </h2>
            <p className="mt-4 max-w-[440px] text-[15px] leading-relaxed text-text-2">
              Your EV charger knows your solar output, electricity rates, and
              home load — so every kilowatt counts.
            </p>
          </div>
          <a
            href={FLUX_URL}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-[10px] bg-[#3b82f6] px-6 py-2.5 text-sm font-semibold text-white transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(59,130,246,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 active:scale-[0.97] sm:self-auto"
          >
            Start Free
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
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {FEATURES.map((feat) => (
            <div
              key={feat.title}
              className="group bg-white p-9 transition-colors hover:bg-[#f5f5f5]"
            >
              <div
                className={`mb-5 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] transition-[transform] duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-[4deg] ${feat.iconBg}`}
              >
                {feat.icon}
              </div>
              <h3 className="mb-1.5 text-[15.5px] font-bold">{feat.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-text-2">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
