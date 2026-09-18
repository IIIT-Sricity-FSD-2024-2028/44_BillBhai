import { useEffect, useState } from 'react';
import { LOGO } from '../../lib/pageAssets.js';

const SUBTITLE = 'ORDER & BILLING SYSTEM';

// Logo + typewriter subtitle (starts after 600ms, 60-100ms per character).
export default function BrandHeader() {
  const [subtitle, setSubtitle] = useState('');

  useEffect(() => {
    let timer;
    let ci = 0;
    function typeText() {
      if (ci <= SUBTITLE.length) {
        setSubtitle(SUBTITLE.substring(0, ci));
        ci += 1;
        timer = setTimeout(typeText, 60 + Math.random() * 40);
      }
    }
    timer = setTimeout(typeText, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="brand-header">
      <img src={LOGO} alt="BillBhai Logo" className="brand-logo-img" />
      <p className="brand-subtitle" id="brandSubtitle">{subtitle}</p>
    </div>
  );
}
