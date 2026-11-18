import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePageSetup from '../hooks/usePageSetup.js';
import { CSS, FONTS } from '../lib/pageAssets.js';
import inlineCss from '../styles/choose-plan-inline.css?inline';
import OnboardingHeader from '../components/choosePlan/OnboardingHeader.jsx';
import PlanCard from '../components/choosePlan/PlanCard.jsx';
import Toast from '../components/choosePlan/Toast.jsx';
import { PLANS } from '../components/choosePlan/plans.js';
import { api, getAuthToken } from '../lib/http.js';

/**
 * Plan choice right after sign-up. The new owner is already signed in (the
 * register call returned a session), so the plan is saved to their business
 * with their own token. Skipping keeps the plan chosen at sign-up.
 */
export default function ChoosePlanPage() {
  usePageSetup({
    title: 'BillBhai - Select Subscription Plan',
    styles: [CSS.dashboard, inlineCss],
    fonts: FONTS.choosePlan,
    bodyClass: 'no-sidebar',
    bodyAttrs: { 'data-app-ready': 'true' },
  });

  const navigate = useNavigate();
  const businessId = localStorage.getItem('activeBusinessId') || '';
  const businessName = localStorage.getItem('activeBusinessName') || 'Your Business';
  const signedIn = Boolean(getAuthToken()) && localStorage.getItem('userRole') === 'admin' && Boolean(businessId);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [busy, setBusy] = useState(false);

  const mounted = useRef(true);
  const redirectTimer = useRef(null);
  useEffect(() => {
    mounted.current = true;
    if (!signedIn) navigate('/login');
    return () => {
      mounted.current = false;
      clearTimeout(redirectTimer.current);
    };
  }, [signedIn, navigate]);

  async function selectPlan(planKey, _monthlyPrice, planName) {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/companies/${encodeURIComponent(businessId)}/plan`, { method: 'POST', body: { plan: planKey } });
      localStorage.setItem('activeBusinessPlan', planKey);
      if (!mounted.current) return;
      setToast({ message: `${planName} activated.`, visible: true });
      redirectTimer.current = setTimeout(() => navigate('/business-welcome'), 700);
    } catch (err) {
      if (!mounted.current) return;
      setToast({ message: `Could not change the plan: ${err.message}`, visible: true });
      setBusy(false);
    }
  }

  return (
    <>
      <OnboardingHeader />

      <main className="content-area" style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 700, marginBottom: '8px' }}>
            Welcome to BillBhai,{' '}
            <span id="displayBusinessName" style={{ color: 'var(--accent)' }}>
              {businessName}
            </span>
            !
          </h2>
          <p className="text-muted" style={{ fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.5 }}>
            Your account is ready and you are signed in. Pick a plan for your team limits and modules. You can change it
            any time from Profile.
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
            style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textDecoration: 'none', transition: 'color 0.2s' }}
          >
            Skip for now &mdash; keep the plan chosen at sign-up &rarr;
          </Link>
        </div>
      </main>

      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
