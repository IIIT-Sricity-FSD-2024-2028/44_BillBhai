import SectionHeader from './SectionHeader.jsx';
import useReveal from './useReveal.js';

const SVG_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '24',
  height: '24',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const FEATURES = [
  {
    title: 'Instant Invoicing',
    description: 'Generate professional GST-compliant invoices in seconds. Auto-calculate taxes, discounts, and totals with zero errors.',
    icon: <svg {...SVG_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  },
  {
    title: 'Real-Time Inventory',
    description: 'Track stock levels across locations with real-time updates. Get low-stock alerts before you run out, never miss a sale.',
    icon: <svg {...SVG_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  },
  {
    title: 'Delivery Tracking',
    description: 'Monitor deliveries from dispatch to doorstep. Real-time status updates keep you and your customers in the loop.',
    icon: <svg {...SVG_PROPS}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
  },
  {
    title: 'Smart Analytics',
    description: 'Understand your business with interactive charts, revenue trends, and category breakdowns — all updated in real time.',
    icon: <svg {...SVG_PROPS}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  },
  {
    title: 'Multi-User Access',
    description: 'Add team members with role-based permissions. Admins, managers, and staff each see exactly what they need.',
    icon: <svg {...SVG_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  },
  {
    title: 'Returns & Refunds',
    description: 'Handle product returns and issue refunds seamlessly. Automatic stock updates and customer communication built in.',
    icon: <svg {...SVG_PROPS}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  },
];

function FeatureCard({ icon, title, description }) {
  const [ref, revealClass] = useReveal();
  return (
    <div ref={ref} className={`feature-card ${revealClass}`}>
      <div className="feature-icon">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default function Features() {
  return (
    <section className="features" id="features">
      <div className="container">
        <SectionHeader
          ids={{ tag: 'featuresTag', title: 'featuresTitle', desc: 'featuresDesc' }}
          tag="Features"
          title="Everything your business needs"
          desc="From lightning-fast invoicing to granular inventory control — BillBhai packs enterprise power into a beautifully simple interface."
        />
        <div className="features-grid" id="featuresGrid">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
