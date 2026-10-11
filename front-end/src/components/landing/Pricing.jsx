import { Link } from 'react-router-dom';
import SectionHeader from './SectionHeader.jsx';

const CHECK = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
);

const CROSS = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

function Feature({ children }) {
  return <li>{CHECK} {children}</li>;
}

function DisabledFeature({ children }) {
  return <li className="disabled">{CROSS} {children}</li>;
}

function PlanHeader({ badge, badgeClass, name, desc, amount }) {
  return (
    <div className="pricing-header">
      <div className={badgeClass ? `pricing-badge ${badgeClass}` : 'pricing-badge'}>{badge}</div>
      <h3 className="plan-name">{name}</h3>
      <p className="plan-desc">{desc}</p>
      <div className="plan-price">
        <span className="currency">₹</span>{' '}
        <span className="amount">{amount}</span>{' '}
        <span className="period">/month</span>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <section className="pricing-section" id="pricing">
      <div className="container">
        <SectionHeader
          tag="Pricing Plans"
          title="Simple, transparent pricing"
          desc="Choose the plan tailored to your retail operations. No hidden fees, upgrade anytime."
        />

        <div className="pricing-grid">
          {/* Starter Plan */}
          <div className="pricing-card">
            <PlanHeader badge="Free Forever" name="Starter Plan" desc="For small retail counters, boutiques, and single-store shops." amount="0" />
            <ul className="plan-features">
              <Feature>Up to <strong>2 Staff Users</strong></Feature>
              <Feature><strong>1 Store Location</strong></Feature>
              <Feature>Up to <strong>300 Products</strong></Feature>
              <Feature>500 Bills / month</Feature>
              <Feature>POS Scanning &amp; Digital Invoices</Feature>
              <Feature>UPI, Card &amp; Cash Payments</Feature>
              <DisabledFeature>Delivery Operations</DisabledFeature>
              <DisabledFeature>Returns &amp; Refund Management</DisabledFeature>
            </ul>
            <Link to="/register-business" className="btn btn-outline plan-btn">Get Started Free</Link>
          </div>

          {/* Pro Plan (Featured) */}
          <div className="pricing-card featured">
            <div className="popular-ribbon">Most Popular</div>
            <PlanHeader badge="Growing Retail" badgeClass="pro-badge" name="Growth / Pro" desc="For busy stores and expanding multi-counter outlets." amount="1,999" />
            <ul className="plan-features">
              <Feature>Up to <strong>10 Staff Users</strong></Feature>
              <Feature>Up to <strong>3 Store Outlets</strong></Feature>
              <Feature>Up to <strong>5,000 Products</strong></Feature>
              <Feature><strong>Unlimited Invoices</strong></Feature>
              <Feature><strong>Delivery Management</strong> &amp; Rider Dispatch</Feature>
              <Feature><strong>Returns, Refunds &amp; Exchanges</strong></Feature>
              <Feature>Promo Codes &amp; Discounts Engine</Feature>
              <Feature>Priority Chat &amp; Phone Support</Feature>
            </ul>
            <Link to="/register-business?plan=pro" className="btn btn-primary plan-btn">Start 14-Day Free Trial</Link>
          </div>

          {/* Enterprise Plan */}
          <div className="pricing-card">
            <PlanHeader badge="Large Chains" badgeClass="enterprise-badge" name="Enterprise" desc="For supermarket chains, multi-warehouse & franchise brands." amount="4,999" />
            <ul className="plan-features">
              <Feature><strong>Unlimited Staff Users</strong></Feature>
              <Feature><strong>Unlimited Stores &amp; Warehouses</strong></Feature>
              <Feature><strong>Unlimited Products &amp; SKUs</strong></Feature>
              <Feature><strong>Customer Self-Checkout Kiosks</strong></Feature>
              <Feature>Inter-Store Inventory Transfers</Feature>
              <Feature>Advanced Multi-Branch Audit Logs</Feature>
              <Feature>Dedicated Account Manager</Feature>
              <Feature>99.9% Uptime SLA</Feature>
            </ul>
            <Link to="/register-business?plan=enterprise" className="btn btn-outline plan-btn">Enroll Now</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
