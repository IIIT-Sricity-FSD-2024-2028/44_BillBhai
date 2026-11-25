import { useEffect } from 'react';
import usePageSetup from '../../shared/hooks/usePageSetup.js';
import { CSS, FONTS } from '../../shared/lib/pageAssets.js';
import Navbar from './components/Navbar.jsx';
import Hero from './components/Hero.jsx';
import Features from './components/Features.jsx';
import Stats from './components/Stats.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import Pricing from './components/Pricing.jsx';
import Testimonials from './components/Testimonials.jsx';
import Cta from './components/Cta.jsx';
import Footer from './components/Footer.jsx';

const TITLE = 'BillBhai - Smart Billing and Inventory for Modern Businesses';
const DESCRIPTION =
  'BillBhai is the all-in-one billing, inventory, and order management platform built for Indian businesses. Fast invoices, real-time stock tracking, and powerful analytics.';

function useMetaDescription(content) {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = content;
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [content]);
}

export default function LandingPage() {
  usePageSetup({ title: TITLE, styles: [CSS.landing], fonts: FONTS.landing });
  useMetaDescription(DESCRIPTION);

  return (
    <>
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>
      <div className="ambient-glow glow-3"></div>
      <div className="grid-pattern"></div>

      <Navbar />
      <Hero />
      <Features />
      <Stats />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <Cta />
      <Footer />
    </>
  );
}
