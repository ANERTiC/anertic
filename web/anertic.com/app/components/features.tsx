import { ScrollReveal } from "./scroll-reveal";

const FEATURES = [
  {
    title: "Smart Energy Monitoring",
    description:
      "Real-time tracking across all meters and devices. The AI spots anomalies before they become problems.",
    iconBg: "bg-accent/[0.07]",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0d9668"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: "EV Charging Management",
    description:
      "OCPP-native control of your charging stations. Smart scheduling, load balancing, and session analytics.",
    iconBg: "bg-indigo-500/[0.07]",
    icon: (
      <svg
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
    title: "AI-Powered Insights",
    description:
      "Ask your energy agent anything. Get actionable recommendations, cost analysis, and optimization strategies.",
    iconBg: "bg-amber-500/[0.07]",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a7 7 0 0 1 0 14 7 7 0 0 1 0-14" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: "Analytics Dashboard",
    description:
      "Comprehensive energy analytics with historical trends, cost breakdowns, and consumption patterns.",
    iconBg: "bg-rose-500/[0.07]",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#e11d48"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
  {
    title: "Multi-Site Management",
    description:
      "Manage energy across multiple buildings, floors, and rooms from a single intelligent platform.",
    iconBg: "bg-cyan-600/[0.07]",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0891b2"
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
    title: "IoT Device Integration",
    description:
      "Connect meters, sensors, and chargers via MQTT and OCPP. Your AI agent speaks every protocol.",
    iconBg: "bg-violet-600/[0.07]",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9333ea"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1120px] px-8 py-24">
      <ScrollReveal>
        <p className="text-xs font-bold tracking-[0.08em] text-accent">
          FEATURES
        </p>
        <h2 className="mt-2.5 text-4xl font-extrabold leading-tight tracking-[-0.035em]">
          One AI. Every energy decision.
        </h2>
        <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-text-2">
          Your agent understands your devices, learns your patterns, and acts on
          your behalf.
        </p>
      </ScrollReveal>

      <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feat, i) => (
          <ScrollReveal key={feat.title} delay={i * 50}>
            <div className="group bg-white p-9 transition-colors hover:bg-[#f5f5f5]">
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
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
