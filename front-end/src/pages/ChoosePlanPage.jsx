import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePageSetup from '../hooks/usePageSetup.js';
import { CSS, FONTS } from '../lib/pageAssets.js';
import inlineCss from '../styles/choose-plan-inline.css?inline';
import OnboardingHeader from '../components/choosePlan/OnboardingHeader.jsx';
import PlanCard from '../components/choosePlan/PlanCard.jsx';
import Toast from '../components/choosePlan/Toast.jsx';
import { PLANS } from '../components/choosePlan/plans.js';

// React port of choose-plan.html (and its inline <style>/<script>).

// Kept as in the original page script (other pages use port 4000).
const API_BASE_URL = 'http://localhost:3000/api';

function readSignupData() {
  try {
    const raw = sessionStorage.getItem('bb_recent_business_signup');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed data
  }
  return null;
}

export default function ChoosePlanPage() {
  usePageSetup({
    title: 'BillBhai - Select Subscription Plan',
    styles: [CSS.dashboard, inlineCss],
    fonts: FONTS.choosePlan,
    bodyClass: 'no-sidebar',
    bodyAttrs: { 'data-app-ready': 'true' },
  });

  const navigate = useNavigate();
  const signupData = useRef(null);
  const [businessName] = useState(() => {
    signupData.current = readSignupData();
    return signupData.current && signupData.current.businessName
      ? signupData.current.businessName
      : 'Your Business';
  });
  const [toast, setToast] = useState({ message: 'Plan activated successfully!', visible: false });

  const mounted = useRef(true);
  const redirectTimer = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(redirectTimer.current);
    };
  }, []);

  async function selectPlan(planKey, monthlyPrice, planName) {
    localStorage.setItem('activeBusinessPlan', planKey);
    const data = signupData.current;
    if (data) {
      data.plan = planKey;
      data.planName = planName;
      data.monthlyPrice = monthlyPrice;
      sessionStorage.setItem('bb_recent_business_signup', JSON.stringify(data));
    }

    const bizId = data && data.businessId;
    if (bizId) {
      try {
        await fetch(`${API_BASE_URL}/companies/${encodeURIComponent(String(bizId))}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-role': 'superuser' },
          body: JSON.stringify({
            plan: planKey,
            productsPlan: planName,
            monthlyPrice,
            subscriptionStatus: 'Active',
          }),
        });
      } catch (err) {
        console.warn('Backend sync failed, stored in localStorage:', err);
      }
    }

    // The "Skip" link navigates away immediately, like the original page did.
    if (!mounted.current) return;
    setToast({ message: `${planName} activated! Loading your dashboard credentials...`, visible: true });
    redirectTimer.current = setTimeout(() => {
      navigate('/business-welcome');
    }, 800);
  }

  return (
    <>
      <OnboardingHeader />

      <main className="content-area" style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 700, marginBottom: '8px' }}>
            Welcome to BillBhai, <span id="displayBusinessName" style={{ color: 'var(--accent)' }}>{businessName}</span>!
          </h2>
          <p className="text-muted" style={{ fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.5 }}>
            Your account is ready. Select a subscription plan to configure your team limits, outlets, and unlocked modules. You can upgrade or change anytime.
          </p>
        </div>

        <div className="subscription-plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '22px' }}>
          {PLANS.map((plan) => (
            <PlanCard key={plan.key} plan={plan} onSelect={selectPlan} />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <Link
            to="/business-welcome"
            onClick={() => selectPlan('starter', 0, 'Starter Plan (Free)')}
            style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textDecoration: 'none', transition: 'color 0.2s' }}
          >
            Skip for now &mdash; continue with Free Starter Tier &rarr;
          </Link>
        </div>
      </main>

      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
