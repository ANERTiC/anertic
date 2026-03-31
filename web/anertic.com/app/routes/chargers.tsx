import type { Route } from "./+types/chargers";
import { Nav } from "~/components/nav";
import { FluxHero } from "~/components/flux/hero";
import { FluxStats } from "~/components/flux/stats";
import { HomeCharging } from "~/components/flux/home-charging";
import { BusinessCharging } from "~/components/flux/business-charging";
import { FleetManagement } from "~/components/flux/fleet-management";
import { CompatibleChargers } from "~/components/flux/compatible-chargers";
import { FluxCta } from "~/components/flux/cta";
import { Footer } from "~/components/footer";

export const meta: Route.MetaFunction = () => [
  { title: "Flux by ANERTiC — Any Charger. One Platform." },
  {
    name: "description",
    content:
      "Connect any OCPP charger to Flux. Smart scheduling, load balancing, and billing — for your home, your business, or your fleet.",
  },
  { property: "og:title", content: "Flux by ANERTiC — EV Charging Platform" },
  {
    property: "og:description",
    content:
      "Software-only EV charging management. Works with any OCPP 1.6 & 2.0.1 charger — no vendor lock-in.",
  },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://flux.anertic.com" },
];

export default function Chargers() {
  return (
    <div id="main" className="min-h-screen">
      <Nav />
      <FluxHero />
      <FluxStats />
      <HomeCharging />
      <BusinessCharging />
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        <div className="border-t border-border" />
      </div>
      <FleetManagement />
      <CompatibleChargers />
      <FluxCta />
      <Footer />
    </div>
  );
}
