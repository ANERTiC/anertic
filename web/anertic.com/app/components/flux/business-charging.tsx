import { ScrollReveal } from "../scroll-reveal";

const SITES = [
  { name: "HQ Office", pct: 87, color: "#3b82f6" },
  { name: "Siam Complex", pct: 64, color: "#6366f1" },
  { name: "Riverside", pct: 92, color: "#3b82f6" },
];

const USER_GROUPS = [
  { label: "Employees", initials: "EM", bg: "bg-[#3b82f6]" },
  { label: "Tenants", initials: "TN", bg: "bg-[#6366f1]" },
  { label: "Visitors", initials: "VT", bg: "bg-[#06b6d4]" },
  { label: "Guests", initials: "GU", bg: "bg-[#8b5cf6]" },
];

export function BusinessCharging() {
  return (
    <section id="business-charging" className="bg-bg-soft">
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        {/* ── Header ── */}
        <ScrollReveal>
          <p className="text-xs font-bold tracking-[0.08em] text-[#3b82f6]">
            FOR BUSINESSES
          </p>
          <div className="mt-2.5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
                Turn every parking spot into a revenue stream
              </h2>
              <p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-text-2">
                Your chargers sit idle most of the day. Flux helps you monetize
                every session with automated billing, access control, and
                real-time analytics — no manual work.
              </p>
            </div>
            <a
              href="#contact"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-[10px] border border-[#3b82f6] px-6 py-2.5 text-sm font-semibold text-[#3b82f6] transition-[transform,box-shadow,background-color,color] motion-safe:hover:-translate-y-0.5 hover:bg-[#3b82f6] hover:text-white hover:shadow-[0_4px_20px_rgba(59,130,246,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 active:scale-[0.97] sm:self-auto"
            >
              Contact Sales
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

        {/* ── Bento Grid ── */}
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Card 1 — large, spans 2 rows on desktop */}
          <ScrollReveal
            delay={0}
            className="sm:row-span-2"
          >
            <div className="group flex h-full min-h-[340px] flex-col justify-between rounded-2xl border border-border bg-white p-8 transition-shadow hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] sm:min-h-0">
              {/* Icon */}
              <div>
                <div className="mb-5 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-blue-500/[0.07] transition-transform duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-[4deg]">
                  <svg
                    aria-hidden="true"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </svg>
                </div>
                <h3 className="mb-1.5 text-[17px] font-bold leading-snug">
                  One screen for every location
                </h3>
                <p className="text-[13.5px] leading-relaxed text-text-2">
                  Managing chargers across multiple sites shouldn't mean
                  multiple logins. See real-time status, utilization, and
                  revenue for every location in a single dashboard.
                </p>
              </div>

              {/* Mini dashboard mockup */}
              <div
                aria-hidden="true"
                className="mt-8 rounded-xl border border-border bg-bg-soft px-5 py-4"
              >
                <p className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-2/60">
                  Site utilization — live
                </p>
                <ul className="flex flex-col gap-3.5">
                  {SITES.map((site) => (
                    <li key={site.name}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[12px] font-medium text-text-2">
                          {site.name}
                        </span>
                        <span
                          className="text-[12px] font-bold tabular-nums"
                          style={{ color: site.color }}
                        >
                          {site.pct}%
                        </span>
                      </div>
                      <div className="h-[5px] w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-out"
                          style={{
                            width: `${site.pct}%`,
                            background: site.color,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                {/* Fake micro-stats row */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
                  {[
                    { val: "3", unit: "Sites" },
                    { val: "24", unit: "Chargers" },
                    { val: "฿18.4k", unit: "This month" },
                  ].map((stat) => (
                    <div key={stat.unit} className="text-center">
                      <p className="text-[13px] font-bold">{stat.val}</p>
                      <p className="text-[10px] text-text-2/60">{stat.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Right column — Card 2 and Card 3 stack on top of each other */}
          <div className="contents sm:flex sm:flex-col sm:gap-4">
            {/* Card 2 */}
            <ScrollReveal delay={80} className="sm:flex-1">
              <div className="group flex h-full flex-col rounded-2xl border border-border bg-white p-8 transition-shadow hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
                <div className="mb-5 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-indigo-500/[0.07] transition-transform duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-[4deg]">
                  <svg
                    aria-hidden="true"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <circle cx="12" cy="16" r="1" fill="#6366f1" />
                  </svg>
                </div>
                <h3 className="mb-1.5 text-[15.5px] font-bold leading-snug">
                  Control who charges and when
                </h3>
                <p className="text-[13.5px] leading-relaxed text-text-2">
                  Stop unauthorized usage eating your electricity budget. RFID,
                  app-based auth, and guest codes — you decide who has access.
                </p>
                {/* Access method pills */}
                <div
                  aria-hidden="true"
                  className="mt-5 flex flex-wrap gap-2"
                >
                  {["RFID", "App auth", "Guest code", "PIN"].map((method) => (
                    <span
                      key={method}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-600"
                    >
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Card 3 */}
            <ScrollReveal delay={120} className="sm:flex-1">
              <div className="group flex h-full flex-col rounded-2xl border border-border bg-white p-8 transition-shadow hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
                <div className="mb-5 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-cyan-500/[0.07] transition-transform duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-[4deg]">
                  <svg
                    aria-hidden="true"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <path d="M9.5 13.5C9.5 12.4 10.6 12 12 12s2.5.4 2.5 1.5-1.1 1.5-2.5 1.5-2.5.6-2.5 1.5 1.1 1.5 2.5 1.5 2.5-.4 2.5-1.5" />
                  </svg>
                </div>
                <h3 className="mb-1.5 text-[15.5px] font-bold leading-snug">
                  Automated billing, zero manual work
                </h3>
                <p className="text-[13.5px] leading-relaxed text-text-2">
                  Stop chasing invoices. Flux bills per kWh, per minute, or
                  flat fee — automatically. Configurable rates, automated
                  reports, clean reconciliation.
                </p>
                {/* Billing mode row */}
                <div
                  aria-hidden="true"
                  className="mt-5 grid grid-cols-3 gap-2"
                >
                  {[
                    { label: "Per kWh", icon: "⚡" },
                    { label: "Per min", icon: "⏱" },
                    { label: "Flat fee", icon: "฿" },
                  ].map((mode) => (
                    <div
                      key={mode.label}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-bg-soft py-3 text-center"
                    >
                      <span className="text-[15px]">{mode.icon}</span>
                      <span className="text-[10.5px] font-semibold text-text-2">
                        {mode.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Card 4 — wide, spans full grid width */}
          <ScrollReveal delay={160} className="sm:col-span-2">
            <div className="group flex flex-col gap-6 rounded-2xl border border-border bg-white p-8 transition-shadow hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:gap-10">
              {/* Icon */}
              <div className="shrink-0">
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[12px] bg-violet-500/[0.07] transition-transform duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-[4deg]">
                  <svg
                    aria-hidden="true"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>

              {/* Text */}
              <div className="flex-1">
                <h3 className="mb-1.5 text-[15.5px] font-bold leading-snug">
                  Employee and tenant charging, simplified
                </h3>
                <p className="text-[13.5px] leading-relaxed text-text-2">
                  Set different rates for employees, tenants, and visitors.
                  Automatic deductions, usage reports per user group, and zero
                  admin overhead.
                </p>
              </div>

              {/* User group avatars */}
              <div
                aria-hidden="true"
                className="flex shrink-0 flex-col gap-2.5 sm:items-end"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-2/50">
                  User groups
                </p>
                <div className="flex items-center gap-2">
                  {USER_GROUPS.map((g, i) => (
                    <div
                      key={g.label}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white ${g.bg}`}
                      style={{ zIndex: USER_GROUPS.length - i }}
                      title={g.label}
                    >
                      {g.initials}
                    </div>
                  ))}
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border bg-bg-soft text-[10px] font-semibold text-text-2/50 ring-2 ring-white">
                    +
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {USER_GROUPS.map((g) => (
                    <span key={g.label} className="text-[11px] text-text-2/60">
                      {g.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
