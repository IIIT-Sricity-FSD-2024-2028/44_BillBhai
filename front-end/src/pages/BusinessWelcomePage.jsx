import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageSetup from '../hooks/usePageSetup.js';
import { FONTS } from '../lib/pageAssets.js';
import inlineCss from '../styles/business-welcome-inline.css?inline';
import InfoRow from '../components/businessWelcome/InfoRow.jsx';
import WelcomeActions from '../components/businessWelcome/WelcomeActions.jsx';

// React port of business-welcome.html (and its inline <style>/<script>).

// Returns the parsed signup record, or null when it is missing/unreadable
// (the original page then sent the user back to registration).
function readSignupData() {
  const raw = sessionStorage.getItem('bb_recent_business_signup');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function planLabel(data) {
  if (data.planName) return data.planName;
  if (data.plan === 'enterprise') return 'Enterprise Plan (₹4,999/mo)';
  if (data.plan === 'pro') return 'Growth / Pro Plan (₹1,999/mo)';
  return 'Starter Plan (Free Forever)';
}

function establishNewAdminSession(data, targetPage) {
  localStorage.setItem('activeBusinessId', String(data.businessId || '').trim());
  localStorage.setItem('activeBusinessName', String(data.businessName || '').trim());
  localStorage.setItem('activeBusinessPlan', String(data.plan || 'starter').trim());
  localStorage.setItem('userRole', 'admin');
  localStorage.setItem('userName', String(data.username || '').trim());
  localStorage.setItem('currentUser', JSON.stringify({
    id: data.adminUserId || `USR-${Date.now()}`,
    username: String(data.username || '').trim(),
    name: String(data.ownerName || data.username || 'Admin').trim(),
    role: 'admin',
    email: String(data.email || '').trim(),
    companyId: String(data.businessId || '').trim(),
    businessName: String(data.businessName || '').trim(),
    plan: String(data.plan || 'starter').trim(),
  }));
  if (targetPage) {
    sessionStorage.setItem('bb_post_login_redirect', String(targetPage).trim());
  }
}

export default function BusinessWelcomePage() {
  usePageSetup({ title: 'BillBhai - Business Ready', styles: [inlineCss], fonts: FONTS.businessWelcome });

  const navigate = useNavigate();
  const [data] = useState(readSignupData);
  const redirected = useRef(false);

  useEffect(() => {
    if (!data && !redirected.current) {
      redirected.current = true;
      navigate('/register-business');
    }
  }, [data, navigate]);

  const show = (value) => (data && value) || '-';

  return (
    <main className="card">
      <h1>Your Business Is Ready</h1>
      <p className="muted">Use these credentials to sign in and manage your business, then add more users from the Users section.</p>
      <section className="grid">
        <InfoRow label="Business ID" id="businessId" value={show(data && data.businessId)} />
        <InfoRow label="Business Name" id="businessName" value={show(data && data.businessName)} />
        <InfoRow label="Active Subscription" id="planName" value={data ? planLabel(data) : '-'} valueStyle={{ color: '#10b981' }} />
        <InfoRow label="Owner" id="ownerName" value={show(data && data.ownerName)} />
        <InfoRow label="Admin Username" id="username" value={show(data && data.username)} />
        <InfoRow label="Admin Password" id="password" value={show(data && data.password)} />
        <InfoRow label="Email" id="email" value={show(data && data.email)} />
      </section>
      {/* Session keys are stored before either link navigates (dashboard.html is the post-login redirect). */}
      <WelcomeActions onBeforeLeave={() => data && establishNewAdminSession(data, 'dashboard.html')} />
    </main>
  );
}
