import { Nav } from "~/components/nav";
import { Hero } from "~/components/hero";
import { Stats } from "~/components/stats";
import { Notifications } from "~/components/notifications";
import { Features } from "~/components/features";
import { InAction } from "~/components/in-action";
import { Integrations } from "~/components/integrations";
import { HowItWorks } from "~/components/how-it-works";
import { Pricing } from "~/components/pricing";
import { Contact } from "~/components/contact";
import { Footer } from "~/components/footer";

export default function Home() {
  return (
    <div id="main" className="min-h-screen">
      <Nav />
      <Hero />
      <Stats />
      <Notifications />
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8"><div className="border-t border-border" /></div>
      <Features />
      <InAction />
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8"><div className="border-t border-border" /></div>
      <Integrations />
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
