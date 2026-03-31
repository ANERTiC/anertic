import { ScrollReveal } from "./scroll-reveal";

const STATS = [
  {
    number: "50+",
    label: "Compatible device brands",
    sub: null,
  },
  {
    number: "3",
    label: "Protocols supported",
    sub: "OCPP · MQTT · Modbus",
  },
  {
    number: "30%",
    label: "Average energy savings",
    sub: null,
  },
  {
    number: "24/7",
    label: "Real-time monitoring",
    sub: null,
  },
];

export function Stats() {
  return (
    <section className="w-full bg-bg-soft">
      <div className="mx-auto max-w-[1120px] px-5 py-10 sm:px-8 sm:py-14">
        <ScrollReveal>
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={[
                  "flex flex-col items-center px-6 py-4 text-center",
                  i < STATS.length - 1
                    ? "sm:border-r sm:border-border"
                    : "",
                  i % 2 === 0 && i < STATS.length - 2
                    ? "border-b border-border sm:border-b-0"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <dt className="order-2 mt-1 text-[13px] leading-snug text-text-2">
                  {stat.label}
                  {stat.sub && (
                    <span className="mt-0.5 block text-[11px] tracking-wide text-text-3">
                      {stat.sub}
                    </span>
                  )}
                </dt>
                <dd className="order-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums text-accent sm:text-[40px]">
                  {stat.number}
                </dd>
              </div>
            ))}
          </dl>
        </ScrollReveal>
      </div>
    </section>
  );
}
