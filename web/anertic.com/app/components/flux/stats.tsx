import { ScrollReveal } from "../scroll-reveal";
import { cn } from "~/lib/utils";

const STATS = [
  {
    number: "40%",
    label: "Average charging cost reduction",
    sub: "vs. unmanaged charging",
  },
  {
    number: "200+",
    label: "Compatible OCPP chargers",
    sub: "1.6 · 2.0.1",
  },
  {
    number: "24/7",
    label: "Automated scheduling",
    sub: "Solar · off-peak · demand",
  },
  {
    number: "0",
    label: "Vendor lock-in",
    sub: "Your charger, our software",
  },
];

export function FluxStats() {
  return (
    <section className="w-full bg-bg-soft">
      <div className="mx-auto max-w-[1120px] px-5 py-10 sm:px-8 sm:py-14">
        <ScrollReveal>
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  "flex flex-col items-center px-6 py-4 text-center",
                  i < STATS.length - 1 && "sm:border-r sm:border-border",
                  i % 2 === 0 &&
                    i < STATS.length - 2 &&
                    "border-b border-border sm:border-b-0",
                )}
              >
                <dt className="order-2 mt-1 text-[13px] leading-snug text-text-2">
                  {stat.label}
                  {stat.sub && (
                    <span className="mt-0.5 block text-[11px] tracking-wide text-text-3">
                      {stat.sub}
                    </span>
                  )}
                </dt>
                <dd className="order-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums text-[#3b82f6] sm:text-[40px]">
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
