# Flux by ANERTiC — Chargers Landing Page

**Date:** 2026-03-31
**Status:** Approved

## Overview

A new `/chargers` page on the anertic.com landing site for **Flux by ANERTiC** — the EV charging sub-brand. Software-only platform that manages any OCPP charger. Targets three audiences: homeowners, businesses, and fleet operators.

## Brand

- **Name:** Flux by ANERTiC
- **Positioning:** EV charging product under the ANERTiC umbrella
- **Accent color:** Electric blue `#3b82f6` (distinct from ANERTiC green `#0d9668`)
- **Nav:** Reuses main anertic.com nav with a "Flux" link added
- **Core message:** "Your hardware. Our software." — no vendor lock-in, any OCPP charger

## Page Structure

Seven sections, single scrolling page matching existing landing page patterns.

### Section 1: Hero

- **Chip:** `FLUX BY ANERTIC` (blue accent)
- **Headline:** "Any charger. One platform."
- **Subtitle:** "Connect any OCPP charger. Smart scheduling, load balancing, and billing — for your home, your business, or your fleet."
- **CTA buttons:** "Start Free" (blue, links to app.anertic.com) + "Contact Sales" (outline, links to #contact)
- **Visual:** Orb animation reusing home page pattern but with electric blue glow and lightning bolt core icon
- **Background:** Same subtle grid pattern as home hero

### Section 2: Stats Bar

Four stats in a horizontal bar (same layout as home page stats).

| Number | Label | Sub |
|--------|-------|-----|
| Any OCPP | Charger compatible | 1.6 · 2.0.1 |
| 3 | Audiences served | Home · Business · Fleet |
| Real-time | Session monitoring | |
| 0 | Hardware lock-in | Your charger, our software |

- Uses `bg-bg-soft` background
- Numbers in electric blue

### Section 3: Home Charging

- **Label:** `FOR HOMEOWNERS`
- **Headline:** "Charge smarter, not harder"
- **Layout:** Section header + 4-card feature grid (2x2 on desktop, 1-col on mobile)
- **CTA:** "Start Free" (blue)

Features:
1. **Solar-Aware Charging** — Charge when your panels are producing. ANERTiC Flux syncs with your solar inverter to maximize free energy.
2. **Off-Peak Scheduling** — Automatically shift charging to the cheapest electricity rates. Set it once, save every night.
3. **Home Load Balancing** — Prevent breaker trips. Flux dynamically adjusts charging power based on your home's total consumption.
4. **Session Monitoring** — Real-time kWh, cost, and duration for every charge. Full history at your fingertips.

Icon colors: electric blue base, with subtle variation per card (blue, indigo, cyan, violet).

### Section 4: Business Charging

- **Label:** `FOR BUSINESSES`
- **Headline:** "Turn your chargers into revenue"
- **Layout:** Same card grid pattern as Section 3
- **CTA:** "Contact Sales" (outline)

Features:
1. **Multi-Site Dashboard** — Manage all locations from one screen. Real-time status, utilization, and revenue per site.
2. **Access Control & RFID** — Control who charges. Support for RFID cards, app-based auth, and guest access codes.
3. **Billing Per Session** — Automated invoicing with configurable rates. Per-kWh, per-minute, or flat fee.
4. **Workplace & Tenant Programs** — Set rates per user group. Employee charging, tenant billing, visitor access — all configurable.

### Section 5: Fleet Management

- **Label:** `FOR FLEET OPERATORS`
- **Headline:** "Depot charging, optimized"
- **Layout:** Same card grid pattern
- **CTA:** "Contact Sales" (outline)

Features:
1. **Vehicle-to-Charger Assignment** — Assign vehicles to specific chargers or let Flux auto-allocate based on priority and schedule.
2. **Depot Scheduling & Priority Queues** — Set charging windows, priority levels, and departure deadlines per vehicle.
3. **Fleet Energy Cost Reporting** — Per-vehicle and per-route energy cost breakdowns. Export to CSV or integrate via API.
4. **Driver & Vehicle Analytics** — Track charging patterns, energy consumption trends, and driver behavior across your fleet.

### Section 6: Compatible Chargers

- **Label:** `WORKS WITH ANY OCPP CHARGER`
- **Headline:** "Your hardware. Our software."
- **Subtitle:** "Flux connects via OCPP — the open standard supported by 200+ charger manufacturers worldwide."
- **Layout:** Protocol badges (OCPP 1.6, OCPP 2.0.1) + logo grid of popular charger brands
- **Background:** `bg-bg-soft`

Charger brand logos (representative, not exhaustive):
- ABB, Wallbox, Easee, Schneider Electric, EVBox, ChargePoint, Alfen, Zaptec, Kempower, Delta

### Section 7: CTA / Contact

- **Headline:** "Ready to charge smarter?"
- **Split CTA layout:**
  - Left card: "For homeowners" — "Start Free" button (blue)
  - Right card: "For business & fleet" — "Contact Sales" button (outline)
- Reuse contact section pattern from home page

## Technical Details

### New Files
- `web/anertic.com/app/routes/chargers.tsx` — route component, composes all sections
- `web/anertic.com/app/components/flux/hero.tsx`
- `web/anertic.com/app/components/flux/stats.tsx`
- `web/anertic.com/app/components/flux/home-charging.tsx`
- `web/anertic.com/app/components/flux/business-charging.tsx`
- `web/anertic.com/app/components/flux/fleet-management.tsx`
- `web/anertic.com/app/components/flux/compatible-chargers.tsx`
- `web/anertic.com/app/components/flux/cta.tsx`

### Modified Files
- `web/anertic.com/app/components/nav.tsx` — add "Flux" link to nav
- `web/anertic.com/app/routes.ts` or equivalent — add `/chargers` route

### Shared Components
- Reuse `ScrollReveal` from existing components
- Reuse `cn` utility
- Follow same Tailwind CSS 4 patterns, `motion-safe:` animation prefixes, `focus-visible:` outlines

### Accent Color System
The Flux components use electric blue (`#3b82f6`) instead of the ANERTiC green. This is applied directly in component classes (e.g. `bg-[#3b82f6]`, `text-[#3b82f6]`) rather than overriding CSS variables, keeping the sub-brand scoped to the Flux page only.

### Design Constraints
- All animations use `motion-safe:` prefix for reduced-motion accessibility
- GPU-accelerated properties only (transform, opacity) for animations
- No `transition-all` — explicit transition properties
- `aria-hidden="true"` on decorative SVGs
- `focus-visible:` ring on all interactive elements
- Mobile-first responsive: 1-col on mobile, 2-col on tablet, full layout on desktop
- Max width `1120px` matching home page container
