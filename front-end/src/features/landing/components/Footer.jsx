import { Link } from 'react-router-dom';
import useTheme from '../../../shared/hooks/useTheme.js';
import { HashLink } from './smoothScroll.jsx';

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#how-it-works', label: 'How It Works' },
      { href: '#testimonials', label: 'Testimonials' },
    ],
  },
  {
    title: 'Get Started',
    links: [
      { to: '/register-business', label: 'Register Business' },
      { to: '/login', label: 'Sign In' },
      { href: '#stats', label: 'Impact' },
      { href: '#cta', label: 'Start Free Trial' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: 'mailto:support@billbhai.in', label: 'Contact Support' },
      { href: '#how-it-works', label: 'Onboarding Guide' },
      { href: '#pricing', label: 'Plan Limits' },
    ],
  },
];

export default function Footer() {
  const { logo } = useTheme();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <img src={logo} alt="BillBhai" className="footer-logo-img" />
            <p className="footer-tagline" id="footerTagline">
              Smart billing &amp; inventory management for modern Indian businesses.
            </p>
          </div>
          <div className="footer-col" id="footerColumns">
            {FOOTER_COLUMNS.map((column) => (
              <div className="footer-col" key={column.title}>
                <h4>{column.title}</h4>
                {column.links.map((link) =>
                  link.to ? (
                    <Link key={link.label} to={link.to}>
                      {link.label}
                    </Link>
                  ) : link.href.startsWith('#') ? (
                    <HashLink key={link.label} href={link.href}>
                      {link.label}
                    </HashLink>
                  ) : (
                    <a key={link.label} href={link.href}>
                      {link.label}
                    </a>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <p id="footerBottomText">&copy; 2026 BillBhai Systems. All rights reserved.</p>
          <div className="footer-links" id="footerLegalLinks">
            <a href="mailto:support@billbhai.in?subject=Privacy%20Inquiry">Privacy</a>
            <a href="mailto:support@billbhai.in?subject=Terms%20Inquiry">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
