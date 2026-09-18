import { Link } from 'react-router-dom';
import ArrowIcon from './ArrowIcon.jsx';
import useReveal from './useReveal.js';

export default function Cta() {
  const [ref, revealClass] = useReveal();
  return (
    <section className="cta-section" id="cta">
      <div className="container">
        <div ref={ref} className={`cta-card ${revealClass}`}>
          <div className="cta-glow"></div>
          <h2 className="cta-title" id="ctaTitle">Ready to simplify your business?</h2>
          <p className="cta-desc" id="ctaDesc">Join 500+ businesses already using BillBhai. Start your free trial today — no credit card required.</p>
          <div className="cta-actions">
            <Link to="/register-business" className="btn btn-primary btn-lg" id="ctaPrimaryBtn">
              Get Started Free{' '}
              <ArrowIcon />
            </Link>
          </div>
          <p className="cta-note" id="ctaNote">Free 14-day trial · No credit card · Cancel anytime</p>
        </div>
      </div>
    </section>
  );
}
