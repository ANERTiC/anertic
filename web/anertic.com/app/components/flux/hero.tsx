const FLUX_URL =
  typeof process !== "undefined"
    ? (process.env.FLUX_URL ?? "https://flux.anertic.com")
    : "https://flux.anertic.com";

export function FluxHero() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-14 text-center sm:px-8 sm:pb-24 sm:pt-20">
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(90deg,transparent,transparent 79px,rgba(59,130,246,0.025) 79px,rgba(59,130,246,0.025) 80px),repeating-linear-gradient(0deg,transparent,transparent 79px,rgba(59,130,246,0.025) 79px,rgba(59,130,246,0.025) 80px)",
          maskImage:
            "radial-gradient(ellipse 50% 60% at 50% 40%,black,transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 50% 60% at 50% 40%,black,transparent)",
        }}
      />

      {/* Radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[600px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(59,130,246,0.07)_0%,rgba(59,130,246,0.025)_40%,transparent_70%)]"
      />

      {/* Orb */}
      <div className="relative mx-auto mb-8 h-32 w-32 sm:mb-11 sm:h-40 sm:w-40 motion-safe:animate-scale-in motion-safe:[animation-delay:0.1s]">
        {/* Orbit rings */}
        <div
          aria-hidden="true"
          className="absolute -inset-6 rounded-full border border-[#3b82f6]/[0.04] motion-safe:animate-spin-slow motion-safe:[animation-duration:38s]"
        >
          <div className="absolute left-[calc(50%-4px)] top-[30%] h-1 w-1 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.55)] motion-safe:animate-float-y motion-safe:[animation-delay:0.5s]" />
        </div>
        <div
          aria-hidden="true"
          className="absolute -inset-2 rounded-full border border-[#3b82f6]/[0.08] motion-safe:animate-spin-slow motion-safe:[animation-direction:reverse] motion-safe:[animation-duration:28s]"
        >
          <div className="absolute bottom-[20%] right-[-4px] h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)] motion-safe:animate-float-y" />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-2 rounded-full border border-[#3b82f6]/[0.16] motion-safe:animate-spin-slow motion-safe:[animation-duration:18s]"
        >
          <div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#60a5fa] shadow-[0_0_6px_rgba(96,165,250,0.6)]" />
        </div>

        {/* Core orb — blue radial gradient */}
        <div
          aria-hidden="true"
          className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_38%_38%,#60a5fa,#3b82f6_60%,#1d4ed8)] motion-safe:animate-breathe"
          style={{
            ["--tw-animate-breathe-shadow-start" as string]:
              "0 0 0 0 rgba(59,130,246,0.15)",
            ["--tw-animate-breathe-shadow-end" as string]:
              "0 0 60px 10px rgba(59,130,246,0.09)",
          }}
        />

        {/* Lightning bolt icon in orb core */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-6 flex items-center justify-center motion-safe:animate-breathe"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-7 w-7 sm:h-9 sm:w-9 drop-shadow-[0_1px_4px_rgba(255,255,255,0.35)]"
            aria-hidden="true"
          >
            <path
              d="M13 2L4.5 13.5H11.5L11 22L19.5 10.5H12.5L13 2Z"
              fill="white"
              fillOpacity="0.92"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Chip */}
      <div className="motion-safe:animate-rise motion-safe:[animation-delay:0.25s]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eff6ff] px-3.5 py-1 text-xs font-semibold tracking-[0.06em] text-[#3b82f6]">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] motion-safe:animate-breathe motion-safe:[animation-duration:2s]"
          />
          FLUX BY ANERTIC
        </span>
      </div>

      {/* Headline */}
      <h1 className="mx-auto mt-5 max-w-[640px] text-pretty text-3xl font-extrabold leading-[1.08] tracking-[-0.04em] sm:text-4xl md:text-5xl motion-safe:animate-rise motion-safe:[animation-delay:0.35s]">
        Any charger.{" "}
        <span
          style={{ color: "#3b82f6" }}
        >
          One platform.
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mx-auto mt-4 max-w-[520px] text-base leading-relaxed text-text-2 sm:text-[17px] motion-safe:animate-rise motion-safe:[animation-delay:0.45s]">
        Connect any OCPP charger. Smart scheduling, load balancing, and billing
        — for your home, your business, or your fleet.
      </p>

      {/* CTA */}
      <div className="mt-7 flex justify-center gap-2.5 sm:mt-9 motion-safe:animate-rise motion-safe:[animation-delay:0.55s]">
        <a
          href={FLUX_URL}
          className="rounded-[10px] bg-[#3b82f6] px-7 py-3 text-sm font-semibold text-white transition-[transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#2563eb] hover:shadow-[0_4px_16px_rgba(59,130,246,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 active:scale-[0.97]"
        >
          Start Free
        </a>
        <a
          href="#contact"
          className="rounded-[10px] border border-border px-7 py-3 text-sm font-semibold text-text-2 transition-[transform,border-color,color] hover:-translate-y-0.5 hover:border-text-3 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
        >
          Contact Sales
        </a>
      </div>
    </section>
  );
}
