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
        Smarter charging.{" "}
        <span
          style={{ color: "#3b82f6" }}
        >
          Lower costs. Full control.
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mx-auto mt-4 max-w-[520px] text-base leading-relaxed text-text-2 sm:text-[17px] motion-safe:animate-rise motion-safe:[animation-delay:0.45s]">
        Stop overpaying for energy. Flux optimizes every charging session around
        your solar, your rates, and your schedule — whether you manage one
        charger or a hundred.
      </p>

      {/* CTA */}
      <div className="mt-7 flex justify-center gap-2.5 sm:mt-9 motion-safe:animate-rise motion-safe:[animation-delay:0.55s]">
        <a
          href={FLUX_URL}
          className="rounded-[10px] bg-[#3b82f6] px-7 py-3 text-sm font-semibold text-white transition-[transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#2563eb] hover:shadow-[0_4px_16px_rgba(59,130,246,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 active:scale-[0.97]"
        >
          Book a Demo
        </a>
        <a
          href="#contact"
          className="rounded-[10px] border border-border px-7 py-3 text-sm font-semibold text-text-2 transition-[transform,border-color,color] hover:-translate-y-0.5 hover:border-text-3 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
        >
          See How It Works
        </a>
      </div>

      {/* Dashboard mockup — multi-location monitoring */}
      <div className="mx-auto mt-10 max-w-[920px] sm:mt-14 motion-safe:animate-rise motion-safe:[animation-delay:0.7s]">
        <div
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border shadow-[0_20px_80px_rgba(59,130,246,0.08),0_4px_24px_rgba(0,0,0,0.06)]"
          style={{ borderColor: "rgba(59,130,246,0.12)" }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(59,130,246,0.08)", backgroundColor: "#fafbfe" }}>
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-[#ff5f57]" />
              <div className="size-2.5 rounded-full bg-[#febc2e]" />
              <div className="size-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="ml-2 text-[11px] font-semibold text-text-3">Flux — All Locations</span>
          </div>

          {/* Dashboard content */}
          <div className="bg-white p-5 sm:p-6">
            {/* Top stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Chargers", value: "24", sub: "across 4 sites", color: "#3b82f6" },
                { label: "Active Sessions", value: "9", sub: "charging now", color: "#22c55e" },
                { label: "Today's Energy", value: "342 kWh", sub: "+18% vs yesterday", color: "#f59e0b" },
                { label: "Revenue (MTD)", value: "฿48,200", sub: "on track", color: "#8b5cf6" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border p-3 text-left">
                  <p className="text-[11px] font-medium text-text-3">{stat.label}</p>
                  <p className="mt-1 text-[16px] font-extrabold tabular-nums leading-none sm:text-[20px]" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="mt-1 text-[10px] text-text-3">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Location rows */}
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              {/* Header */}
              <div className="hidden border-b border-border bg-[#f8fafc] px-4 py-2 text-[11px] font-semibold text-text-3 sm:grid sm:grid-cols-[1fr_100px_100px_120px_140px] sm:gap-2">
                <span>Location</span>
                <span className="text-center">Chargers</span>
                <span className="text-center">Active</span>
                <span className="text-center">Energy Today</span>
                <span className="text-right">Status</span>
              </div>

              {[
                { name: "HQ Office", city: "Bangkok", chargers: 8, active: 3, energy: "124 kWh", status: "Online", statusColor: "#22c55e", utilization: 38 },
                { name: "Siam Complex", city: "Bangkok", chargers: 6, active: 4, energy: "98 kWh", status: "Online", statusColor: "#22c55e", utilization: 67 },
                { name: "Riverside Mall", city: "Nonthaburi", chargers: 6, active: 2, energy: "86 kWh", status: "Online", statusColor: "#22c55e", utilization: 33 },
                { name: "Depot East", city: "Samut Prakan", chargers: 4, active: 0, energy: "34 kWh", status: "Scheduled", statusColor: "#f59e0b", utilization: 0 },
              ].map((site, i) => (
                <div
                  key={site.name}
                  style={i < 3 ? { borderBottom: "1px solid #f1f3f5" } : undefined}
                >
                  {/* Mobile layout */}
                  <div className="flex items-center justify-between px-4 py-3 sm:hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[12px] font-semibold text-text">{site.name}</p>
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: `${site.statusColor}14`, color: site.statusColor }}
                        >
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: site.statusColor }} />
                          {site.status}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-3 text-[11px] text-text-3">
                        <span>{site.chargers} chargers</span>
                        <span className="font-medium" style={{ color: site.active > 0 ? "#3b82f6" : "#9aa0a6" }}>{site.active} active</span>
                        <span>{site.energy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden items-center gap-2 px-4 py-3 text-[12px] sm:grid sm:grid-cols-[1fr_100px_100px_120px_140px]">
                    <div>
                      <p className="font-semibold text-text">{site.name}</p>
                      <p className="text-[10px] text-text-3">{site.city}</p>
                    </div>
                    <p className="text-center tabular-nums text-text-2">{site.chargers}</p>
                    <p className="text-center tabular-nums font-semibold" style={{ color: site.active > 0 ? "#3b82f6" : "#9aa0a6" }}>{site.active}</p>
                    <p className="text-center tabular-nums text-text-2">{site.energy}</p>
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#f1f3f5]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${site.utilization}%`,
                            backgroundColor: site.utilization > 50 ? "#3b82f6" : "#93c5fd",
                          }}
                        />
                      </div>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: `${site.statusColor}14`, color: site.statusColor }}
                      >
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: site.statusColor }} />
                        {site.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
