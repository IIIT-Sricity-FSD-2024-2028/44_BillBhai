import { useEffect } from 'react';
import usePageSetup from '../hooks/usePageSetup.js';
import { CSS, FONTS } from '../lib/pageAssets.js';
import Navbar from '../components/landing/Navbar.jsx';
import Hero from '../components/landing/Hero.jsx';
import Features from '../components/landing/Features.jsx';
import Stats from '../components/landing/Stats.jsx';
import HowItWorks from '../components/landing/HowItWorks.jsx';
import Pricing from '../components/landing/Pricing.jsx';
import Testimonials from '../components/landing/Testimonials.jsx';
import Cta from '../components/landing/Cta.jsx';
import Footer from '../components/landing/Footer.jsx';

const TITLE = 'BillBhai - Smart Billing and Inventory for Modern Businesses';
const DESCRIPTION = 'BillBhai is the all-in-one billing, inventory, and order management platform built for Indian businesses. Fast invoices, real-time stock tracking, and powerful analytics.';

// index.html's <meta name="description">, present only while this page is mounted.
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
      {/* Ambient Background */}
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
