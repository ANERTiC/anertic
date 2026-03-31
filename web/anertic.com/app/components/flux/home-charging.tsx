import { ScrollReveal } from "../scroll-reveal";

const FLUX_URL =
  typeof process !== "undefined"
    ? (process.env.FLUX_URL ?? "https://flux.anertic.com")
    : "https://flux.anertic.com";

const FEATURES = [
  {
    title: "Charge on free solar",
    description:
      "Why pay the grid when your panels are producing? Flux detects solar surplus and starts charging automatically — zero wasted energy.",
    icon: (
      <svg
        aria-hidden="true"
        width="20"
        height="20"
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
    title: "Never pay peak rates again",
    description:
      "Flux learns your rate schedule and shifts every charge to the cheapest window. Set your departure time — wake up to a full battery and a lower bill.",
    icon: (
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3b82f6"
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
    title: "No more tripped breakers",
    description:
      "Running the AC, oven, and charger at once? Flux dynamically throttles charging power to stay within your home's limits — no electrician upgrade needed.",
    icon: (
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3b82f6"
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
    title: "Know exactly what you're spending",
    description:
      "Real-time cost tracking for every session. See kWh delivered, cost per charge, and monthly savings — all in one dashboard.",
    icon: (
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

function ChargingMockup() {
  // Progress ring via conic-gradient: 75% filled = 270deg
  // Ring is 160x160, stroke width ~14px, so radius ~66px, circumference ~415
  return (
    <div
      aria-hidden="true"
      className="relative flex items-center justify-center"
    >
      {/* Outer glow blob */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.45) 0%, transparent 70%)",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[300px] rounded-[20px] border border-[rgba(59,130,246,0.18)] bg-white p-7 shadow-[0_24px_64px_rgba(0,0,0,0.10),0_4px_16px_rgba(59,130,246,0.08)]"
        style={{ transform: "rotate(2deg)" }}
      >
        {/* Status badge */}
        <div className="mb-6 flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
            style={{ animation: "pulse 2s ease-in-out infinite" }}
          />
          <span className="text-[12px] font-semibold tracking-wide text-emerald-600">
            Charging on Solar
          </span>
        </div>

        {/* Progress ring */}
        <div className="mx-auto mb-6 flex h-[148px] w-[148px] items-center justify-center">
          {/* Track ring */}
          <div
            className="absolute h-[148px] w-[148px] rounded-full"
            style={{
              background:
                "conic-gradient(rgba(59,130,246,0.12) 0deg, rgba(59,130,246,0.12) 360deg)",
            }}
          />
          {/* Background track (inner mask) */}
          <div
            className="absolute h-[120px] w-[120px] rounded-full bg-white"
          />
          {/* Filled arc — 75% = 270deg */}
          <div
            className="absolute h-[148px] w-[148px] rounded-full"
            style={{
              background:
                "conic-gradient(from -90deg, #3b82f6 0deg, #60a5fa 200deg, #a5f3fc 270deg, transparent 270deg)",
              WebkitMaskImage:
                "radial-gradient(transparent 59px, black 59px, black 74px, transparent 74px)",
              maskImage:
                "radial-gradient(transparent 59px, black 59px, black 74px, transparent 74px)",
            }}
          />
          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <span
              className="text-[34px] font-extrabold leading-none tracking-tight"
              style={{ color: "#1e3a5f" }}
            >
              75%
            </span>
            <span className="mt-1 text-[11px] font-medium text-[#94a3b8]">
              charged
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-[10px] bg-[#f8fafc] px-3.5 py-2.5">
            <span className="text-[12px] text-[#64748b]">Energy delivered</span>
            <span className="text-[13px] font-bold text-[#1e293b]">18.4 kWh</span>
          </div>
          <div className="flex items-center justify-between rounded-[10px] bg-[#f0f9ff] px-3.5 py-2.5">
            <span className="text-[12px] text-[#0369a1]">Off-peak rate</span>
            <span className="text-[13px] font-bold text-[#0369a1]">฿58.20</span>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[11.5px] text-[#94a3b8]">Est. complete</span>
            <span className="text-[11.5px] font-semibold text-[#64748b]">
              6:30 AM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeCharging() {
  return (
    <section
      id="home-charging"
      className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24"
    >
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
        {/* Left column — 60% */}
        <div className="flex-[3]">
          <ScrollReveal>
            <p className="text-xs font-bold tracking-[0.08em] text-[#3b82f6]">
              FOR HOMEOWNERS
            </p>
            <h2 className="mt-3 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
              Stop overpaying for every charge
            </h2>
            <p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-text-2">
              Most EV owners charge at peak rates without realizing it. Flux
              automatically shifts your charging to the cheapest hours and free
              solar — saving you up to{" "}
              <strong className="font-semibold text-[#1e293b]">
                40% on every charge
              </strong>
              .
            </p>
          </ScrollReveal>

          {/* Feature rows */}
          <div className="mt-10 flex flex-col">
            {FEATURES.map((feat, i) => (
              <ScrollReveal key={feat.title} delay={i * 60}>
                <div className="group flex gap-4 py-5 first:pt-0 last:pb-0 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border">
                  {/* Icon circle */}
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/[0.08] transition-[transform,background-color] duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:bg-blue-500/[0.14]">
                    {feat.icon}
                  </div>
                  {/* Text */}
                  <div className="min-w-0">
                    <h3 className="text-[14.5px] font-bold leading-snug">
                      {feat.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-text-2">
                      {feat.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={280}>
            <div className="mt-9">
              <a
                href={FLUX_URL}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#3b82f6] px-6 py-2.5 text-sm font-semibold text-white transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(59,130,246,0.30)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 active:scale-[0.97]"
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
        </div>

        {/* Right column — 40% */}
        <div className="flex flex-[2] items-center justify-center lg:justify-end">
          <ScrollReveal delay={120}>
            <ChargingMockup />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
