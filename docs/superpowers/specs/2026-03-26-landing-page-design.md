# ANERTiC Landing Page — anertic.com

## Overview

A public marketing landing page for ANERTiC at `anertic.com`, positioned as an **AI Personal Energy** platform. The page showcases ANERTiC as an agentic AI product that manages EV charging, energy monitoring, and analytics — not just a chat assistant.

**Target audience**: Building/facility managers, EV charging operators, businesses wanting AI-powered energy management.

## Tech Stack

- **Location**: `web/anertic.com/` (new project, separate from `web/app.anertic.com/`)
- **Framework**: React Router 7 with SSR (`ssr: true`) for SEO
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite`)
- **Build**: Vite 7
- **Font**: Plus Jakarta Sans (Google Fonts)
- **Icons**: SVG inline (no icon library dependency)
- **Deployment**: Dockerized Node.js via `react-router-serve` (same pattern as app.anertic.com)

## Visual Design

- **Theme**: Light mode, clean white background (#ffffff / #f7f8fa)
- **Accent color**: Green (#0d9668) — energy/sustainability association
- **Typography**: Plus Jakarta Sans — 800 weight for headings, 400/500 for body
- **Hero element**: Animated green gradient orb with rotating orbit rings and colored data dots — represents the living AI agent
- **Cards/sections**: White cards with subtle borders, hover lift + green border glow
- **Sticky nav**: Frosted glass effect (backdrop-filter blur)

## Animations

All animations respect `prefers-reduced-motion` via `motion-safe` prefix in Tailwind.

- **Hero load**: Staggered `fade-in-up` on orb (scale-in), chip, title, subtitle, CTA — each delayed 100ms
- **Orb**: Continuous `breathe` animation (scale + box-shadow pulse, 5s cycle), orbit rings spin at different speeds/directions, data dots float vertically
- **Scroll-triggered reveals**: `IntersectionObserver` triggers `fade-in-up` (opacity 0 + translateY 28px -> visible) with staggered delays for grid children (50ms increments)
- **Feature cards**: Hover lift (-3px translateY) + green border glow + icon scale/rotate
- **Step numbers**: Hover ring expand (border-color change + outer glow ring)
- **Pricing cards**: Hover lift (-4px) + shadow deepen
- **Buttons**: translateY(-1px) on hover, scale(0.97) on active
- **Nav links**: No underline animation (clean)

## Page Sections

### 1. Navigation (sticky)
- Logo: "ANERTiC" with accent color on "Ti"
- Links: Features, How it Works, Pricing, Contact (smooth scroll anchors)
- Actions: "Sign in" text link + "Get Started" solid button
- Frosted glass background on scroll

### 2. Hero
- Animated orb with orbit rings and colored dots
- Chip badge: "AI PERSONAL ENERGY" with pulsing green dot
- Headline: `Your intelligent agent for smarter energy` (word "intelligent" in accent green)
- Subtitle: "An autonomous AI that monitors, optimizes, and manages your entire energy ecosystem — from EV chargers to power consumption."
- CTA: "Get Started" (solid) + "Learn More" (ghost)
- "Get Started" links to `app.anertic.com`
- "Learn More" scrolls to Features section

### 3. Features (6 cards, 3x2 grid)
Each card: colored icon + title + description

| Feature | Icon Color | Description |
|---------|-----------|-------------|
| Smart Energy Monitoring | Green | Real-time tracking, anomaly detection |
| EV Charging Management | Indigo | OCPP control, scheduling, load balancing |
| AI-Powered Insights | Amber | Natural language queries, recommendations |
| Analytics Dashboard | Rose | Historical trends, cost breakdowns |
| Multi-Site Management | Cyan | Buildings, floors, rooms |
| IoT Device Integration | Violet | MQTT, OCPP protocol support |

### 4. How it Works (3 steps)
Connected by a dashed horizontal line.

1. **Connect Your Devices** — Plug in meters, EV chargers, sensors. OCPP, MQTT support.
2. **AI Learns Your Patterns** — Analyzes usage, identifies waste, builds energy model.
3. **Optimize Automatically** — Real-time recommendations, automated scheduling, cost savings.

### 5. Pricing (3 tiers)

| Tier | Price | Devices | Features |
|------|-------|---------|----------|
| Starter | Free | Up to 5 | Energy monitoring, basic AI, 1 site, 7-day retention |
| Pro (Popular) | $49/mo | Up to 50 | + Advanced AI, EV charger mgmt, multi-site, 90-day retention |
| Enterprise | Custom | Unlimited | + Dedicated AI model, API access, priority support, unlimited retention |

### 6. Contact Form
- Two-column layout: left = heading + description, right = form
- Fields: Name, Email, Message (textarea)
- Submit button: "Send Message"
- Form submissions: TBD (could be a simple mailto, or a backend endpoint)

### 7. Footer
- Logo + copyright
- Links: Privacy, Terms, GitHub

## Project Structure

```
web/anertic.com/
  package.json
  tsconfig.json
  vite.config.ts
  react-router.config.ts
  Dockerfile
  app/
    root.tsx              # HTML shell, fonts, meta
    routes.ts             # Route config
    app.css               # Tailwind entry + custom animations
    routes/
      home.tsx            # Landing page (all sections)
    components/
      nav.tsx             # Sticky navigation
      hero.tsx            # Hero with orb animation
      features.tsx        # Features grid
      how-it-works.tsx    # Steps section
      pricing.tsx         # Pricing cards
      contact.tsx         # Contact form
      footer.tsx          # Footer
      scroll-reveal.tsx   # IntersectionObserver wrapper
    lib/
      utils.ts            # cn() helper
```

## SEO & Meta

- Title: "ANERTiC — AI Personal Energy Platform"
- Description: "An autonomous AI agent that monitors, optimizes, and manages your energy ecosystem. EV charging, smart monitoring, and AI-powered insights."
- Open Graph image: Static OG image with orb + tagline
- Structured data: Organization schema

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_URL` | `https://app.anertic.com` | Dashboard app URL for "Get Started" links |
| `SESSION_SECRET` | `dev-secret` | Signs cookies (for any future session needs) |

## Out of Scope

- Authentication / user sessions
- Backend API integration
- Blog / content pages
- Internationalization
- Contact form backend processing (static form for now)
