import { Nav } from "~/components/nav";
import { Hero } from "~/components/hero";
import { Features } from "~/components/features";
import { InAction } from "~/components/in-action";
import { HowItWorks } from "~/components/how-it-works";
import { Pricing } from "~/components/pricing";
import { Contact } from "~/components/contact";
import { Footer } from "~/components/footer";

export default function Home() {
  return (
    <div id="main" className="min-h-screen">
      <Nav />
      <Hero />
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8"><div className="border-t border-border" /></div>
      <Features />
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8"><div className="border-t border-border" /></div>
      <InAction />
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8"><div className="border-t border-border" /></div>
      <HowItWorks />
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8"><div className="border-t border-border" /></div>
      <Pricing />
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8"><div className="border-t border-border" /></div>
      <Contact />
      <Footer />
    </div>
  );
}
