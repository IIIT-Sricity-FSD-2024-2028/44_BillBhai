import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandHeader from './BrandHeader.jsx';
import LoginForm from './LoginForm.jsx';

// Card wrapper with the subtle 3D tilt that follows the mouse.
export default function LoginCard(props) {
  const cardRef = useRef(null);
  const resetTimer = useRef(null);
  const [tilt, setTilt] = useState({});

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  function handleMouseMove(e) {
    const r = cardRef.current.getBoundingClientRect();
    const rx = ((e.clientY - r.top - (r.height / 2)) / (r.height / 2)) * -3;
    const ry = ((e.clientX - r.left - (r.width / 2)) / (r.width / 2)) * 3;
    setTilt((prev) => ({ ...prev, transform: `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)` }));
  }

  function handleMouseLeave() {
    setTilt({ transform: 'perspective(1000px) rotateX(0) rotateY(0)', transition: 'transform 0.5s ease' });
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setTilt((prev) => ({ transform: prev.transform }));
    }, 500);
  }

  return (
    <div className="login-wrapper">
      <div
        className="login-card"
        id="loginCard"
        ref={cardRef}
        style={tilt}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <BrandHeader />
        <LoginForm {...props} />
        <div className="login-footer">
          <p style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Don&apos;t have an account? <Link to="/register-business" style={{ color: '#dc3545', fontWeight: 600, textDecoration: 'none' }}>Sign Up</Link></p>
          <p>&copy; 2026 BillBhai Systems</p>
        </div>
      </div>
    </div>
  );
}
