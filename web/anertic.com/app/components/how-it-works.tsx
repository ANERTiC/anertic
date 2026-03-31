import { ScrollReveal } from "./scroll-reveal";

const STEPS = [
  {
    num: "1",
    title: "Plug In Any Device",
    description:
      "Smart meters, EV chargers, solar inverters, batteries. Any brand, any protocol — just connect.",
  },
  {
    num: "2",
    title: "AI Maps Your Home",
    description:
      "Usage patterns, solar production, rate schedules, and appliance behavior — modeled in minutes.",
  },
  {
    num: "3",
    title: "Save on Autopilot",
    description:
      "Automated charging schedules, load shifting, and energy optimization. Hands-free savings, every day.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
      <ScrollReveal className="text-center">
        <p className="text-xs font-bold tracking-[0.08em] text-accent">
          HOW IT WORKS
        </p>
        <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
          Three steps to a <span className="text-accent">smarter</span> home
        </h2>
      </ScrollReveal>

      <div className="relative mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
        {/* Dashed connector line */}
        <div
          className="pointer-events-none absolute left-[16%] right-[16%] top-9 hidden h-0.5 sm:block"
          style={{
            background:
              "repeating-linear-gradient(90deg,#e8eaed 0,#e8eaed 8px,transparent 8px,transparent 16px)",
          }}
        />

        {STEPS.map((step, i) => (
          <ScrollReveal key={step.num} delay={i * 50}>
            <div className="group relative text-center">
              <div className="relative z-10 mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-border bg-white text-[22px] font-extrabold text-accent transition-[border-color,box-shadow,transform] duration-300 group-hover:border-accent group-hover:shadow-[0_0_0_6px_#e6f7f0] group-hover:scale-105">
                {step.num}
              </div>
              <h3 className="mb-1.5 text-base font-bold">{step.title}</h3>
              <p className="mx-auto max-w-[240px] text-[13.5px] leading-relaxed text-text-2">
                {step.description}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
