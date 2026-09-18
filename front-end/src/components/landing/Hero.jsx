import { Link } from 'react-router-dom';
import ArrowIcon from './ArrowIcon.jsx';
import { HashLink } from './smoothScroll.jsx';

const PREVIEW_STATS = [
  { tone: 'green', label: 'Revenue', value: '₹58,680' },
  { tone: 'blue', label: 'Orders', value: '124' },
  { tone: 'amber', label: 'Accuracy', value: '98.2%' },
];

const PREVIEW_ROWS = ['green', 'blue', 'amber'];

function DashboardPreview() {
  return (
    <div className="dashboard-preview">
      <div className="preview-topbar">
        <div className="preview-dots">
          <span></span><span></span><span></span>
        </div>
        <span className="preview-url" id="previewUrl">billbhai.vercel.app/dashboard</span>
      </div>
      <div className="preview-body">
        <div className="preview-sidebar">
          <div className="ps-item active"></div>
          <div className="ps-item"></div>
          <div className="ps-item"></div>
          <div className="ps-item"></div>
          <div className="ps-item"></div>
        </div>
        <div className="preview-content">
          <div className="pc-stat-row">
            {PREVIEW_STATS.map((stat, index) => (
              <div className="pc-stat" key={stat.label}>
                <div className={`pc-stat-icon ${stat.tone}`}></div>
                <div className="pc-stat-text">
                  <span className="pc-label" id={`previewStatLabel${index + 1}`}>{stat.label}</span>
                  <span className="pc-val" id={`previewStatValue${index + 1}`}>{stat.value}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="pc-chart">
            <svg viewBox="0 0 300 80" className="chart-line">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(220,53,69,0.3)" />
                  <stop offset="100%" stopColor="rgba(220,53,69,0)" />
                </linearGradient>
              </defs>
              <path d="M0,60 Q30,55 60,45 T120,30 T180,35 T240,15 T300,20" fill="none" stroke="#dc3545" strokeWidth="2" />
              <path d="M0,60 Q30,55 60,45 T120,30 T180,35 T240,15 T300,20 L300,80 L0,80 Z" fill="url(#chartGrad)" />
            </svg>
          </div>
          <div className="pc-table">
            {PREVIEW_ROWS.map((tone) => (
              <div className="pc-row" key={tone}><span></span><span></span><span className={`pc-badge ${tone}`}></span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatCard({ index, tone, icon, label, value }) {
  return (
    <div className={`float-card float-card-${index}`}>
      <div className={`fc-icon ${tone}`} id={`floatCardIcon${index}`}>
        {icon}
      </div>
      <div className="fc-text">
        <span className="fc-label" id={`floatCardLabel${index}`}>{label}</span>
        <span className="fc-value" id={`floatCardValue${index}`}>{value}</span>
      </div>
    </div>
  );
}

const TREND_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
);

const CHECK_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
);

export default function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-badge">
          <span className="badge-dot"></span>
          <span id="heroBadgeText">Trusted by 500+ businesses across India</span>
        </div>
        <h1 className="hero-title">
          <span className="hero-line" id="heroTitleLine1">Billing Made</span>{' '}
          <span className="hero-line hero-accent" id="heroTitleLine2">Effortless.</span>
        </h1>
        <p className="hero-subtitle" id="heroSubtitle">
          BillBhai is the all-in-one platform for invoicing, inventory tracking,
          and order management — designed for speed, built for Indian businesses.
        </p>
        <div className="hero-cta">
          <Link to="/register-business" className="btn btn-primary btn-lg" id="heroPrimaryBtn">
            Start Free Trial{' '}
            <ArrowIcon />
          </Link>{' '}
          <HashLink href="#how-it-works" className="btn btn-outline btn-lg" id="heroSecondaryBtn">See How It Works</HashLink>
        </div>
        <div className="hero-visual">
          <DashboardPreview />
          <FloatCard index={1} tone="green" icon={TREND_ICON} label="Revenue Today" value="₹12,450" />
          <FloatCard index={2} tone="blue" icon={CHECK_ICON} label="Order Completed" value="#4821" />
        </div>
      </div>
    </section>
  );
}
