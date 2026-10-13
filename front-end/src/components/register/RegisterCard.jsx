import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOGO } from '../../lib/pageAssets.js';

// `.register-card` with its header/footer and the mouse-follow 3D tilt.
export default function RegisterCard({ children }) {
  const cardRef = useRef(null);
  const resetTimer = useRef(null);
  const [tilt, setTilt] = useState({});

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  function handleMouseMove(e) {
    const r = cardRef.current.getBoundingClientRect();
    const rx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -2;
    const ry = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 2;
    setTilt((prev) => ({ ...prev, transform: `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)` }));
  }

  function handleMouseLeave() {
    setTilt({ transform: 'perspective(1200px) rotateX(0) rotateY(0)', transition: 'transform 0.5s ease' });
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setTilt((prev) => ({ transform: prev.transform }));
    }, 500);
  }

  return (
    <div className="register-wrapper wide">
      <div
        className="register-card"
        id="registerCard"
        ref={cardRef}
        style={tilt}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="brand-header">
          <img src={LOGO} alt="BillBhai Logo" className="brand-logo-img" />
        </div>

        <h2 className="form-section-title">Business Registration</h2>
        <p className="form-section-desc">Set up your shop on BillBhai in under a minute</p>

        {children}

        <div className="register-footer">
          <p>Already have an account? <Link to="/login">Sign In</Link></p>
        </div>
        <div className="register-copyright"><p>&copy; 2026 BillBhai Systems</p></div>
      </div>
    </div>
  );
}
