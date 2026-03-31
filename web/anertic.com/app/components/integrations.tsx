import { ScrollReveal } from "./scroll-reveal";

const PROTOCOLS = [
  "OCPP 1.6",
  "OCPP 2.0.1",
  "MQTT",
  "Modbus",
  "REST API",
];

const DEVICE_TYPES = [
  {
    label: "Smart Meters",
    icon: (
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0d9668"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 12h8M12 8v8" />
        <circle cx="12" cy="12" r="2" fill="#0d9668" stroke="none" />
      </svg>
    ),
  },
  {
    label: "EV Chargers",
    icon: (
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0d9668"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="16" height="10" rx="2" />
        <path d="M22 11v2" />
        <path d="M6 11v2M10 11v2M14 11v2" />
      </svg>
    ),
  },
  {
    label: "Solar Inverters",
    icon: (
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0d9668"
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
    label: "Batteries",
    icon: (
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0d9668"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="18" height="10" rx="1.5" />
        <path d="M22 11v2" />
        <path d="M7 11.5v1M11 11.5v1M15 11.5v1" />
      </svg>
    ),
  },
  {
    label: "Sensors",
    icon: (
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0d9668"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5.64 5.64a9 9 0 0 0 0 12.72M18.36 5.64a9 9 0 0 1 0 12.72" />
        <path d="M8.46 8.46a5 5 0 0 0 0 7.07M15.54 8.46a5 5 0 0 1 0 7.07" />
        <circle cx="12" cy="12" r="1.5" fill="#0d9668" stroke="none" />
      </svg>
    ),
  },
];

export function Integrations() {
  return (
    <section className="w-full bg-bg">
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <ScrollReveal className="text-center">
          <p className="text-xs font-bold tracking-[0.08em] text-accent">
            OPEN PROTOCOL
          </p>
          <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
            Works with your devices
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-relaxed text-text-2">
            No vendor lock-in. ANERTiC connects via open standards — your
            devices, your choice.
          </p>
        </ScrollReveal>

        {/* Protocol badges */}
        <ScrollReveal delay={80}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
            {PROTOCOLS.map((protocol) => (
              <span
                key={protocol}
                className="rounded-full border border-border px-4 py-2 text-[13px] font-medium text-text-2"
              >
                {protocol}
              </span>
            ))}
          </div>
        </ScrollReveal>

        {/* Device type grid */}
        <ScrollReveal delay={160}>
          <div className="mt-12 grid grid-cols-3 gap-6 sm:grid-cols-5">
            {DEVICE_TYPES.map((device) => (
              <div
                key={device.label}
                className="group flex flex-col items-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft transition-[box-shadow,transform] duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_4px_#e6f7f0]">
                  {device.icon}
                </div>
                <span className="mt-2 text-center text-[13px] font-medium leading-snug text-text-2">
                  {device.label}
                </span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
