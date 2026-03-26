const APP_URL =
  typeof process !== "undefined"
    ? (process.env.APP_URL ?? "https://app.anertic.com")
    : "https://app.anertic.com";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-8 pb-24 pt-20 text-center">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(90deg,transparent,transparent 79px,rgba(0,0,0,0.018) 79px,rgba(0,0,0,0.018) 80px),repeating-linear-gradient(0deg,transparent,transparent 79px,rgba(0,0,0,0.018) 79px,rgba(0,0,0,0.018) 80px)",
          maskImage:
            "radial-gradient(ellipse 50% 60% at 50% 40%,black,transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 50% 60% at 50% 40%,black,transparent)",
        }}
      />

      {/* Radial glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[600px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(13,150,104,0.06)_0%,rgba(13,150,104,0.02)_40%,transparent_70%)]" />

      {/* Orb */}
      <div className="relative mx-auto mb-11 h-40 w-40 motion-safe:animate-scale-in motion-safe:[animation-delay:0.1s]">
        {/* Orbit rings */}
        <div className="absolute -inset-6 rounded-full border border-accent/[0.03] motion-safe:animate-spin-slow motion-safe:[animation-duration:38s]">
          <div className="absolute left-[calc(50%-9px)] top-[30%] h-1 w-1 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)] motion-safe:animate-float-y motion-safe:[animation-delay:0.5s]" />
        </div>
        <div className="absolute -inset-2 rounded-full border border-accent/[0.06] motion-safe:animate-spin-slow motion-safe:[animation-direction:reverse] motion-safe:[animation-duration:28s]">
          <div className="absolute bottom-[20%] right-[-4px] h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)] motion-safe:animate-float-y" />
        </div>
        <div className="absolute inset-2 rounded-full border border-accent/[0.12] motion-safe:animate-spin-slow motion-safe:[animation-duration:18s]">
          <div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_6px_rgba(13,150,104,0.5)]" />
        </div>

        {/* Core orb */}
        <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_38%_38%,#34d399,#0d9668_60%,#065f46)] motion-safe:animate-breathe" />
      </div>

      {/* Chip */}
      <div className="motion-safe:animate-rise motion-safe:[animation-delay:0.25s]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-bg px-3.5 py-1 text-xs font-semibold tracking-[0.06em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-breathe motion-safe:[animation-duration:2s]" />
          AI PERSONAL ENERGY
        </span>
      </div>

      {/* Headline */}
      <h1 className="mx-auto mt-5 max-w-[620px] text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] sm:text-5xl motion-safe:animate-rise motion-safe:[animation-delay:0.35s]">
        Your <span className="text-accent">intelligent</span> agent
        <br />
        for smarter energy
      </h1>

      {/* Subtitle */}
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-text-2 sm:text-[17px] motion-safe:animate-rise motion-safe:[animation-delay:0.45s]">
        An autonomous AI that monitors, optimizes, and manages your entire
        energy ecosystem — from EV chargers to power consumption.
      </p>

      {/* CTA */}
      <div className="mt-9 flex justify-center gap-2.5 motion-safe:animate-rise motion-safe:[animation-delay:0.55s]">
        <a
          href={APP_URL}
          className="rounded-[10px] bg-accent px-7 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(13,150,104,0.2)] active:scale-[0.97]"
        >
          Get Started
        </a>
        <a
          href="#features"
          className="rounded-[10px] border border-border px-7 py-3 text-sm font-semibold text-text-2 transition-all hover:-translate-y-0.5 hover:border-text-3 hover:text-text"
        >
          Learn More
        </a>
      </div>
    </section>
  );
}
