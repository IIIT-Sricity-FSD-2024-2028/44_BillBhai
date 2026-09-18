import { Fragment, useEffect, useRef, useState } from 'react';
import useReveal from './useReveal.js';

const STATS = [
  { target: 500, suffix: '+', label: 'Active Businesses' },
  { target: 1200000, suffix: '', label: 'Invoices Generated' },
  { target: 99, suffix: '.9%', label: 'Uptime Guarantee' },
  { target: 4, suffix: 'sec', label: 'Avg. Invoice Time' },
];

const COUNTER_DURATION = 2000;

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

// Counts up from 0 (ease-out cubic over 2s) the first time the number is half visible.
function useCounter(target) {
  const ref = useRef(null);
  const [text, setText] = useState('0');

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;

    const animate = () => {
      const start = performance.now();
      const step = (timestamp) => {
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / COUNTER_DURATION, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        if (progress < 1) {
          setText(formatNumber(Math.floor(eased * target)));
          frame = requestAnimationFrame(step);
        } else {
          setText(formatNumber(target));
        }
      };
      frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return [ref, text];
}

function StatItem({ target, suffix, label }) {
  const [revealRef, revealClass] = useReveal();
  const [numberRef, text] = useCounter(target);
  return (
    <div ref={revealRef} className={`stat-item ${revealClass}`}>
      <span ref={numberRef} className="stat-number" data-target={target}>{text}</span>{' '}
      <span className="stat-suffix">{suffix}</span>{' '}
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function Stats() {
  return (
    <section className="stats" id="stats">
      <div className="container">
        <div className="stats-row" id="statsRow">
          {STATS.map((stat, index) => (
            <Fragment key={stat.label}>
              {index > 0 && <div className="stat-divider"></div>}
              <StatItem {...stat} />
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
