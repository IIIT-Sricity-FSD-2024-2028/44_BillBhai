import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AmbientGlow from '../components/login/AmbientGlow.jsx';
import LoginCard from '../components/login/LoginCard.jsx';
import '../styles/style.css';

export default function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldStatus, setFieldStatus] = useState({
    username: { error: false, shake: false },
    password: { error: false, shake: false },
  });

  useEffect(() => {
    document.title = 'BillBhai - Admin Login';
  }, []);

  const handleFieldFocus = (fieldName) => {
    setFieldStatus((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], error: false },
    }));
  };

  const handleShakeEnd = (fieldName) => {
    setFieldStatus((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], shake: false },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim()) {
      setFieldStatus({
        username: { error: true, shake: true },
        password: { error: false, shake: false },
      });
      return;
    }
    if (!password.trim()) {
      setFieldStatus({
        username: { error: false, shake: false },
        password: { error: true, shake: true },
      });
      return;
    }

    setIsLoading(true);

    try {
      let response;
      try {
        response = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        });
      } catch {
        response = await fetch('http://localhost:4000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        });
      }

      if (!response.ok) {
        setFieldStatus((prev) => ({
          ...prev,
          password: { error: true, shake: true },
        }));
        if (response.status === 401) {
          setErrorMessage('Incorrect username or password.');
        } else {
          setErrorMessage('Authentication failed. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      const userData = await response.json();

      const rawRole = String(userData.role || '').toLowerCase();
      let role = 'admin';
      if (rawRole === 'superuser' || rawRole === 'super') role = 'superuser';
      else if (rawRole === 'cashier') role = 'cashier';
      else if (rawRole.includes('return')) role = 'returnhandler';
      else if (rawRole.includes('inventory')) role = 'inventorymanager';
      else if (rawRole.includes('delivery')) role = 'deliveryops';
      else if (rawRole === 'customer' || rawRole === 'user') role = 'customer';

      localStorage.setItem('userRole', role);
      localStorage.setItem('userName', userData.username);
      localStorage.setItem('currentUser', JSON.stringify({
        id: userData.id,
        username: userData.username,
        name: userData.name || userData.username,
        role: role,
        email: userData.email || '',
        companyId: userData.companyId || null,
      }));

      if (userData.companyId) {
        localStorage.setItem('activeBusinessId', userData.companyId);
        localStorage.setItem('activeBusinessName', userData.businessName || 'BillBhai');
      }

      setIsLoading(false);
      setIsSuccess(true);

      setTimeout(() => {
        if (role === 'superuser') {
          navigate('/superuser');
        } else if (role === 'cashier') {
          navigate('/cashier');
        } else if (role === 'returnhandler') {
          navigate('/returns');
        } else if (role === 'inventorymanager') {
          navigate('/inventory');
        } else if (role === 'deliveryops') {
          navigate('/delivery');
        } else {
          navigate('/dashboard');
        }
      }, 1000);

    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('Backend is unavailable. Start backend server and try again.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <AmbientGlow />
      <LoginCard
        username={username}
        password={password}
        rememberMe={rememberMe}
        showPassword={showPassword}
        fieldStatus={fieldStatus}
        errorMessage={errorMessage}
        isLoading={isLoading}
        isSuccess={isSuccess}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onTogglePassword={() => setShowPassword(!showPassword)}
        onToggleRemember={() => setRememberMe(!rememberMe)}
        onForgotClick={() => setErrorMessage('Password reset is backend-managed. Please contact system admin.')}
        onFieldFocus={handleFieldFocus}
        onShakeEnd={handleShakeEnd}
        onSubmit={handleSubmit}
      />
    </>
  );
}
