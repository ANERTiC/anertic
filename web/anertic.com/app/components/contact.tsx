import { ScrollReveal } from "./scroll-reveal";

export function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-[1120px] px-8 py-24">
      <div className="grid grid-cols-1 items-start gap-16 md:grid-cols-2">
        <ScrollReveal>
          <p className="text-xs font-bold tracking-[0.08em] text-accent">
            CONTACT
          </p>
          <h2 className="mt-2.5 text-4xl font-extrabold leading-tight tracking-[-0.035em]">
            Let's talk energy
          </h2>
          <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-text-2">
            Have questions about ANERTiC? Want to discuss enterprise needs? We'd
            love to hear from you.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="text"
              name="name"
              placeholder="Name"
              className="rounded-xl border border-border bg-white px-4 py-3.5 text-sm text-text outline-none transition-all placeholder:text-text-3 focus:border-accent focus:ring-[3px] focus:ring-accent-bg"
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              className="rounded-xl border border-border bg-white px-4 py-3.5 text-sm text-text outline-none transition-all placeholder:text-text-3 focus:border-accent focus:ring-[3px] focus:ring-accent-bg"
            />
            <textarea
              name="message"
              placeholder="Message"
              rows={5}
              className="resize-none rounded-xl border border-border bg-white px-4 py-3.5 text-sm text-text outline-none transition-all placeholder:text-text-3 focus:border-accent focus:ring-[3px] focus:ring-accent-bg"
            />
            <button
              type="submit"
              className="self-start rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(13,150,104,0.2)] active:scale-[0.97]"
            >
              Send Message
            </button>
          </form>
        </ScrollReveal>
      </div>
    </section>
  );
}
