import { cn } from "~/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

const APP_URL =
  typeof process !== "undefined"
    ? (process.env.APP_URL ?? "https://app.anertic.com")
    : "https://app.anertic.com";

const PLANS = [
  {
    name: "Starter",
    price: "฿1,500",
    period: "/mo",
    note: "1–3 smart meters included",
    hardware: "Hardware from ฿15,000",
    features: [
      "Real-time dashboard",
      "Basic alerts",
      "Monthly reports",
      "1 site",
    ],
    cta: "Get Started",
    href: APP_URL,
    featured: false,
  },
  {
    name: "Business",
    price: "฿6,000",
    period: "/mo",
    note: "5–10 meters + EV chargers",
    hardware: "Hardware from ฿80,000",
    features: [
      "Everything in Starter",
      "AI anomaly detection",
      "EV load balancing",
      "Solar & battery integration",
      "API access",
    ],
    cta: "Get Started",
    href: APP_URL,
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: null,
    note: "20+ meters, multi-site, EV fleet",
    hardware: null,
    features: [
      "Everything in Business",
      "White-label option",
      "Dedicated onboarding",
      "SLA 99.9% uptime",
      "Custom AI reports",
    ],
    cta: "Contact Us",
    href: "#contact",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
      <ScrollReveal className="text-center">
        <p className="text-xs font-bold tracking-[0.08em] text-accent">
          PRICING
        </p>
        <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
          Hardware + AI, one platform
        </h2>
        <p className="mx-auto mt-4 max-w-[420px] text-[15px] leading-relaxed text-text-2">
          Smart meters and AI-powered software bundled together. Pay annually
          and get 2 months free.
        </p>
      </ScrollReveal>

      <div className="mx-auto mt-10 grid max-w-[860px] grid-cols-1 gap-5 sm:mt-14 md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <ScrollReveal key={plan.name} delay={i * 50}>
            <div
              className={cn(
                "relative rounded-2xl border bg-white p-6 text-center transition-[transform,box-shadow] duration-300 hover:-translate-y-1 sm:p-8",
                plan.featured
                  ? "border-accent shadow-[0_0_0_1px_#0d9668,0_8px_32px_rgba(13,150,104,0.08)] hover:shadow-[0_0_0_1px_#0d9668,0_12px_40px_rgba(13,150,104,0.12)]"
                  : "border-border hover:shadow-[0_12px_36px_rgba(0,0,0,0.05)]",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold tracking-[0.08em] text-white">
                  RECOMMENDED
                </span>
              )}

              <p className="text-[13px] font-medium text-text-2">{plan.name}</p>
              <p className="mt-1.5 text-[34px] font-extrabold tabular-nums tracking-[-0.03em] sm:text-[42px]">
                {plan.price}
                {plan.period && (
                  <span className="text-sm font-normal text-text-3">
                    {plan.period}
                  </span>
                )}
              </p>
              <p className="text-[12.5px] text-text-3">{plan.note}</p>
              {plan.hardware && (
                <p className="mt-1 text-[12px] font-medium text-accent">
                  {plan.hardware}
                </p>
              )}
              <div className="mb-6" />

              <ul className="mb-6 flex flex-col gap-2.5 text-left">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="relative pl-5 text-[13px] text-text-2 before:absolute before:left-0 before:top-1.5 before:h-2.5 before:w-2.5 before:rounded-full before:border-[1.5px] before:border-accent before:bg-accent-bg"
                  >
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={cn(
                  "block w-full rounded-lg py-2.5 text-[13px] font-semibold transition-[transform,box-shadow,border-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.97]",
                  plan.featured
                    ? "bg-accent text-white hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(13,150,104,0.2)]"
                    : "border border-border bg-bg-soft text-text-2 hover:border-text-3 hover:text-text",
                )}
              >
                {plan.cta}
              </a>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
