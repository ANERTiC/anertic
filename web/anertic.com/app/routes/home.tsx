import { Nav } from '~/components/nav'
import { Hero } from '~/components/hero'
import { Features } from '~/components/features'
import { HowItWorks } from '~/components/how-it-works'
import { Pricing } from '~/components/pricing'
import { Contact } from '~/components/contact'
import { Footer } from '~/components/footer'

export default function Home() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <div className="mx-auto max-w-[1120px] border-t border-border" />
      <Features />
      <div className="mx-auto max-w-[1120px] border-t border-border" />
      <HowItWorks />
      <div className="mx-auto max-w-[1120px] border-t border-border" />
      <Pricing />
      <div className="mx-auto max-w-[1120px] border-t border-border" />
      <Contact />
      <Footer />
    </div>
  )
}
