import { ScrollReveal } from "../scroll-reveal";

const FEATURES = [
  {
    title: "Vehicle-to-Charger Assignment",
    description:
      "Assign vehicles to specific chargers or let Flux auto-allocate based on priority and schedule. Zero manual coordination.",
    iconBg: "bg-[#3b82f6]/[0.07]",
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
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
        <rect x="9" y="11" width="14" height="10" rx="2" />
        <path d="M14 11v-1a1 1 0 0 0-1-1h-1" />
        <path d="M18 11v-1a1 1 0 0 0-1-1h-1" />
        <circle cx="12" cy="19" r="1" />
        <circle cx="20" cy="19" r="1" />
      </svg>
    ),
  },
  {
    title: "Depot Scheduling & Priority Queues",
    description:
      "Set charging windows, priority levels, and departure deadlines per vehicle. Flux ensures every vehicle is ready on time.",
    iconBg: "bg-[#6366f1]/[0.07]",
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
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h2M12 14h.01M16 14h.01M8 18h.01M12 18h2" />
      </svg>
    ),
  },
  {
    title: "Fleet Energy Cost Reporting",
    description:
      "Per-vehicle and per-route energy cost breakdowns. Export to CSV or integrate via API for your accounting and sustainability reports.",
    iconBg: "bg-[#06b6d4]/[0.07]",
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
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
        <path d="M14 13h3M14 17h3M6 13h.01M6 17h.01" />
      </svg>
    ),
  },
  {
    title: "Driver & Vehicle Analytics",
    description:
      "Track charging patterns, energy consumption trends, and driver behavior across your entire fleet in one unified view.",
    iconBg: "bg-[#8b5cf6]/[0.07]",
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
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
];

export function FleetManagement() {
  return (
    <section
      id="fleet"
      className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24"
    >
      <ScrollReveal>
        <p className="text-xs font-bold tracking-[0.08em] text-[#3b82f6]">
          FOR FLEET OPERATORS
        </p>
        <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
          Depot charging, optimized
        </h2>
        <p className="mt-4 max-w-[440px] text-[15px] leading-relaxed text-text-2">
          From a handful of company vehicles to a depot of 100+, Flux handles
          scheduling, allocation, and reporting automatically.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={80}>
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {FEATURES.map((feat) => (
            <div
              key={feat.title}
              className="group bg-white p-9 transition-colors hover:bg-[#f5f5f5]"
            >
              <div
                className={`mb-5 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] transition-transform duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-[4deg] ${feat.iconBg}`}
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

      <ScrollReveal delay={160}>
        <div className="mt-10 flex justify-start">
          <a
            href="#contact"
            className="rounded-[10px] border border-border px-7 py-3 text-sm font-semibold text-text-2 transition-[transform,border-color,color] hover:-translate-y-0.5 hover:border-[#3b82f6]/50 hover:text-[#3b82f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            Contact Sales
          </a>
        </div>
      </ScrollReveal>
    </section>
  );
}
