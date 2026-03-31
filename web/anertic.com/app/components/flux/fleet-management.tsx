import { ScrollReveal } from "../scroll-reveal";

const FEATURES = [
  {
    number: "01",
    title: "Every vehicle, right charger, right time",
    description:
      "Manual charger assignments waste time and create bottlenecks. Flux auto-allocates based on departure priority, battery state, and charger availability.",
  },
  {
    number: "02",
    title: "Never miss a departure deadline",
    description:
      "Set departure times and Flux builds the optimal charging schedule. High-priority vehicles charge first. Night shift vehicles fill in the gaps.",
  },
  {
    number: "03",
    title: "See where every baht goes",
    description:
      "Per-vehicle, per-route energy cost breakdowns. Know exactly which vehicles cost the most to charge — and why. Export to CSV or pull via API.",
  },
  {
    number: "04",
    title: "Spot problems before they cost you",
    description:
      "Track charging patterns and consumption trends across your fleet. Identify inefficient vehicles, unusual spikes, and driver behavior issues early.",
  },
];

export function FleetManagement() {
  return (
    <section
      id="fleet"
      style={{ backgroundColor: "#0f1117" }}
      className="w-full py-16 sm:py-24"
    >
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        {/* Header */}
        <ScrollReveal>
          <p className="text-xs font-bold tracking-[0.08em] text-[#60a5fa]">
            FOR FLEET OPERATORS
          </p>
          <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
            Cut fleet charging costs. Hit every departure on time.
          </h2>
          <p className="mt-4 max-w-[500px] text-[15px] leading-relaxed text-[#9ca3af]">
            Unmanaged depot charging wastes energy and misses deadlines. Flux
            schedules every vehicle around your rates, priorities, and routes —
            so your fleet is always ready.
          </p>
        </ScrollReveal>

        {/* Feature rows */}
        <ScrollReveal delay={80}>
          <div
            className="mt-14 overflow-hidden rounded-2xl"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {FEATURES.map((feat, index) => (
              <div
                key={feat.number}
                className="group relative transition-colors duration-300 motion-safe:transition-colors hover:bg-[#3b82f6]/[0.03]"
                style={
                  index > 0
                    ? { borderTop: "1px solid rgba(255,255,255,0.06)" }
                    : undefined
                }
              >
                {/* Desktop: 3-column single row */}
                <div className="hidden items-center gap-8 px-8 py-7 sm:flex lg:gap-12 lg:px-10 lg:py-8">
                  {/* Number */}
                  <div
                    aria-hidden="true"
                    className="w-[72px] shrink-0 select-none text-[48px] font-extrabold tabular-nums text-[#3b82f6] opacity-20 leading-none"
                  >
                    {feat.number}
                  </div>

                  {/* Title */}
                  <div className="w-[260px] shrink-0 lg:w-[300px]">
                    <h3 className="text-[15.5px] font-bold leading-snug text-white">
                      {feat.title}
                    </h3>
                  </div>

                  {/* Vertical rule */}
                  <div
                    aria-hidden="true"
                    className="h-10 w-px shrink-0 bg-white/[0.06]"
                  />

                  {/* Description */}
                  <p className="flex-1 text-[13.5px] leading-relaxed text-[#9ca3af]">
                    {feat.description}
                  </p>
                </div>

                {/* Mobile: stacked layout */}
                <div className="flex flex-col gap-2 px-6 py-6 sm:hidden">
                  <div className="flex items-baseline gap-4">
                    <span
                      aria-hidden="true"
                      className="select-none text-[36px] font-extrabold tabular-nums text-[#3b82f6] opacity-20 leading-none"
                    >
                      {feat.number}
                    </span>
                    <h3 className="text-[15px] font-bold leading-snug text-white">
                      {feat.title}
                    </h3>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[#9ca3af]">
                    {feat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal delay={160}>
          <div className="mt-10 flex justify-start">
            <a
              href="#contact"
              className="rounded-[10px] bg-[#3b82f6] px-7 py-3 text-sm font-semibold text-white transition-[transform,opacity] duration-200 hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1117] active:scale-[0.97] motion-safe:transition-[transform,opacity]"
            >
              Book a Demo
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
