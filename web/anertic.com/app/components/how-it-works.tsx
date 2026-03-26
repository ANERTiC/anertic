import { ScrollReveal } from './scroll-reveal'

const STEPS = [
  {
    num: '1',
    title: 'Connect Your Devices',
    description: 'Plug in your meters, EV chargers, and sensors. We support OCPP, MQTT, and more.',
  },
  {
    num: '2',
    title: 'AI Learns Your Patterns',
    description: 'Your agent analyzes usage, identifies waste, and builds an energy model of your operation.',
  },
  {
    num: '3',
    title: 'Optimize Automatically',
    description: 'Real-time recommendations, automated scheduling, and cost savings — managed by your AI agent.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1120px] px-8 py-24">
      <ScrollReveal className="text-center">
        <p className="text-xs font-bold tracking-[0.08em] text-accent">
          HOW IT WORKS
        </p>
        <h2 className="mt-2.5 text-4xl font-extrabold leading-tight tracking-[-0.035em]">
          Three steps to{' '}
          <span className="text-accent">smarter</span> energy
        </h2>
      </ScrollReveal>

      <div className="relative mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
        {/* Dashed connector line */}
        <div
          className="pointer-events-none absolute left-[16%] right-[16%] top-9 hidden h-0.5 sm:block"
          style={{
            background:
              'repeating-linear-gradient(90deg,#e8eaed 0,#e8eaed 8px,transparent 8px,transparent 16px)',
          }}
        />

        {STEPS.map((step, i) => (
          <ScrollReveal key={step.num} delay={i * 50}>
            <div className="group relative text-center">
              <div className="relative z-10 mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-border bg-white text-[22px] font-extrabold text-accent transition-all duration-300 group-hover:border-accent group-hover:shadow-[0_0_0_6px_#e6f7f0] group-hover:scale-105">
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
  )
}
