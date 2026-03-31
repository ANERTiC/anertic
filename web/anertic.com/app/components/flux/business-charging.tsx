import { ScrollReveal } from "../scroll-reveal";

const FEATURES = [
  {
    title: "Multi-Site Dashboard",
    description:
      "Manage all locations from one screen. Real-time status, utilization, and revenue per site.",
    iconBg: "bg-blue-500/[0.07]",
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
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    title: "Access Control & RFID",
    description:
      "Control who charges. Support for RFID cards, app-based auth, and guest access codes.",
    iconBg: "bg-indigo-500/[0.07]",
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
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1" fill="#6366f1" />
      </svg>
    ),
  },
  {
    title: "Billing Per Session",
    description:
      "Automated invoicing with configurable rates. Per-kWh, per-minute, or flat fee.",
    iconBg: "bg-cyan-500/[0.07]",
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <path d="M9.5 13.5C9.5 12.4 10.6 12 12 12s2.5.4 2.5 1.5-1.1 1.5-2.5 1.5-2.5.6-2.5 1.5 1.1 1.5 2.5 1.5 2.5-.4 2.5-1.5" />
      </svg>
    ),
  },
  {
    title: "Workplace & Tenant Programs",
    description:
      "Set rates per user group. Employee charging, tenant billing, visitor access — all configurable.",
    iconBg: "bg-violet-500/[0.07]",
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
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export function BusinessCharging() {
  return (
    <section
      id="business-charging"
      className="bg-bg-soft"
    >
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <ScrollReveal>
          <p className="text-xs font-bold tracking-[0.08em] text-[#3b82f6]">
            FOR BUSINESSES
          </p>
          <div className="mt-2.5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
                Turn your chargers into revenue
              </h2>
              <p className="mt-4 max-w-[440px] text-[15px] leading-relaxed text-text-2">
                Full OCPP fleet management with access control, automated
                billing, and a real-time dashboard across every site.
              </p>
            </div>
            <a
              href="#contact"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-[10px] border border-[#3b82f6] px-6 py-2.5 text-sm font-semibold text-[#3b82f6] transition-[transform,box-shadow,background-color,color] hover:-translate-y-0.5 hover:bg-[#3b82f6] hover:text-white hover:shadow-[0_4px_20px_rgba(59,130,246,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 active:scale-[0.97] sm:self-auto"
            >
              Contact Sales
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
                className="group bg-bg-soft p-9 transition-colors hover:bg-[#eef0f3]"
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
      </div>
    </section>
  );
}
