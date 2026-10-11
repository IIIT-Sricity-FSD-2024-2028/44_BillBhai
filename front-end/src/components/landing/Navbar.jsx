import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOGO } from '../../lib/pageAssets.js';
import { HashLink } from './smoothScroll.jsx';

const SCROLL_THRESHOLD = 50;

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#stats', label: 'Impact' },
  { href: '#testimonials', label: 'Testimonials' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(() => window.scrollY > SCROLL_THRESHOLD);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // The open mobile menu locks page scrolling.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <nav className={scrolled ? 'navbar scrolled' : 'navbar'} id="navbar">
      <div className="container nav-container">
        <HashLink href="#" className="nav-brand">
          <img src={LOGO} alt="BillBhai" className="nav-logo-img" />
        </HashLink>
        <div className={menuOpen ? 'nav-links open' : 'nav-links'} id="navLinks">
          {NAV_LINKS.map((link) => (
            <HashLink key={link.href} href={link.href} className="nav-link" onClick={() => setMenuOpen(false)}>
              {link.label}
            </HashLink>
          ))}
        </div>
        <div className="nav-actions">
          <Link to="/login" className="btn btn-ghost" id="navSignInBtn">Sign In</Link>
          <HashLink href="#cta" className="btn btn-primary" id="navPrimaryBtn">Get Started Free</HashLink>
        </div>
        <button className="mobile-toggle" id="mobileToggle" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  );
}
