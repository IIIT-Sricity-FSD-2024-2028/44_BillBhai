import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandHeader from './BrandHeader.jsx';
import LoginForm from './LoginForm.jsx';

export default function LoginCard(props) {
  const cardRef = useRef(null);
  const [tiltStyle, setTiltStyle] = useState({});

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const rotateX = (y / (rect.height / 2)) * -3;
    const rotateY = (x / (rect.width / 2)) * 3;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
      transition: 'transform 0.5s ease',
    });
  };

  return (
    <div className="login-wrapper">
      <div
        id="loginCard"
        ref={cardRef}
        className="login-card"
        style={tiltStyle}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <BrandHeader />
        <LoginForm {...props} />

        <div className="login-footer">
          <p style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
            Don't have an account?{' '}
            <Link to="/register-business" style={{ color: '#dc3545', fontWeight: 600, textDecoration: 'none' }}>
              Sign Up
            </Link>
          </p>
          <p>&copy; 2026 BillBhai Systems</p>
        </div>
      </div>
    </div>
  );
}
