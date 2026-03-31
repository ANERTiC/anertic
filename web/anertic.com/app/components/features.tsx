import { ScrollReveal } from "./scroll-reveal";

const FEATURES = [
  {
    title: "Any Brand, One Dashboard",
    description:
      "Connect meters, chargers, and inverters from any manufacturer. OCPP, MQTT, Modbus — your AI speaks every protocol.",
    iconBg: "bg-accent/[0.07]",
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0d9668"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    title: "Smart EV Charging",
    description:
      "Optimize home charging around your electricity rates. Load balance across vehicles and the rest of your home automatically.",
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
      >
        <rect x="2" y="7" width="16" height="10" rx="2" />
        <line x1="22" y1="11" x2="22" y2="13" />
        <path d="M6 11v2M10 11v2M14 11v2" />
      </svg>
    ),
  },
  {
    title: "Solar & Battery Intelligence",
    description:
      "Track production, consumption, and storage in real time. The AI maximizes self-consumption and minimizes grid dependency.",
    iconBg: "bg-amber-500/[0.07]",
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    title: "Smart Notifications",
    description:
      "\"Sun's out — run the washing machine for free solar.\" Weather-aware tips that save 10–15% without any smart plugs.",
    iconBg: "bg-rose-500/[0.07]",
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#e11d48"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    title: "Automated Savings",
    description:
      "From passive tips to full automation — the AI shifts loads to off-peak, balances solar, and cuts your bill hands-free.",
    iconBg: "bg-cyan-600/[0.07]",
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0891b2"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: "Real-Time Monitoring",
    description:
      "Live dashboards showing every watt flowing through your home. Anomaly detection catches problems before your bill does.",
    iconBg: "bg-violet-600/[0.07]",
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9333ea"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
      <ScrollReveal>
        <p className="text-xs font-bold tracking-[0.08em] text-accent">
          FOR HOMEOWNERS
        </p>
        <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
          Your home energy, fully automated
        </h2>
        <p className="mt-4 max-w-[440px] text-[15px] leading-relaxed text-text-2">
          No vendor lock-in. ANERTiC connects to any device and learns your home
          — so you save without thinking about it.
        </p>
      </ScrollReveal>

      <ScrollReveal>
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat) => (
            <div key={feat.title} className="group bg-white p-9 transition-colors hover:bg-[#f5f5f5]">
              <div
                className={`mb-5 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-[4deg] ${feat.iconBg}`}
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
