import { LOGO } from '../../lib/pageAssets.js';
import { HashLink } from './smoothScroll.jsx';

// Mirrors index.html, including the extra wrapping `.footer-col#footerColumns`.
const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#how-it-works', label: 'How It Works' },
      { href: '#', label: 'Pricing' },
      { href: '#', label: 'Integrations' },
    ],
  },
  { title: 'Company', links: ['About Us', 'Careers', 'Blog', 'Contact'].map((label) => ({ href: '#', label })) },
  { title: 'Support', links: ['Help Center', 'Documentation', 'API Reference', 'Status'].map((label) => ({ href: '#', label })) },
];

const LEGAL_LINKS = ['Privacy', 'Terms'];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <img src={LOGO} alt="BillBhai" className="footer-logo-img" />
            <p className="footer-tagline" id="footerTagline">Smart billing &amp; inventory management for modern Indian businesses.</p>
          </div>
          <div className="footer-col" id="footerColumns">
            {FOOTER_COLUMNS.map((column) => (
              <div className="footer-col" key={column.title}>
                <h4>{column.title}</h4>
                {column.links.map((link, index) => (
                  <HashLink key={index} href={link.href}>{link.label}</HashLink>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <p id="footerBottomText">&copy; 2026 BillBhai Systems. All rights reserved.</p>
          <div className="footer-links" id="footerLegalLinks">
            {LEGAL_LINKS.map((label) => (
              <HashLink key={label} href="#">{label}</HashLink>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
