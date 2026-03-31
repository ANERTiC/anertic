import { ScrollReveal } from "../scroll-reveal";

const PROTOCOLS = ["OCPP 1.6", "OCPP 2.0.1"];

const BRANDS = [
  "ABB",
  "Wallbox",
  "Easee",
  "Schneider Electric",
  "EVBox",
  "ChargePoint",
  "Alfen",
  "Zaptec",
  "Kempower",
  "Delta",
];

export function CompatibleChargers() {
  return (
    <section className="w-full bg-bg-soft">
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <ScrollReveal className="text-center">
          <p className="text-xs font-bold tracking-[0.08em] text-[#3b82f6]">
            WORKS WITH ANY OCPP CHARGER
          </p>
          <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
            Your hardware. Our software.
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-relaxed text-text-2">
            Flux connects via OCPP — the open standard supported by 200+ charger
            manufacturers worldwide.
          </p>
        </ScrollReveal>

        {/* Protocol badges */}
        <ScrollReveal delay={80}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
            {PROTOCOLS.map((protocol) => (
              <span
                key={protocol}
                className="rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-[#3b82f6]"
              >
                {protocol}
              </span>
            ))}
          </div>
        </ScrollReveal>

        {/* Brand grid */}
        <ScrollReveal delay={160}>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {BRANDS.map((brand) => (
              <div
                key={brand}
                className="flex items-center justify-center rounded-xl border border-border bg-white px-4 py-5 text-[14px] font-semibold text-text-2 transition-[border-color,transform] duration-300 motion-safe:hover:-translate-y-0.5 hover:border-[#3b82f6]/30"
              >
                {brand}
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Footer note */}
        <ScrollReveal delay={220}>
          <p className="mt-8 text-center text-[13px] text-text-3">
            Don't see your charger?{" "}
            <a
              href="#contact"
              className="font-medium text-[#3b82f6] underline-offset-2 transition-[opacity] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
            >
              Let us know
            </a>{" "}
            — if it speaks OCPP, we can connect it.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
