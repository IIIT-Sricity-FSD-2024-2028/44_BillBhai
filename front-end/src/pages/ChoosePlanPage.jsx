import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import usePageSetup from '../hooks/usePageSetup.js';
import { CSS, FONTS } from '../lib/pageAssets.js';
import inlineCss from '../styles/choose-plan-inline.css?inline';
import OnboardingHeader from '../components/choosePlan/OnboardingHeader.jsx';
import PlanCard from '../components/choosePlan/PlanCard.jsx';
import Toast from '../components/choosePlan/Toast.jsx';
import { PLANS } from '../components/choosePlan/plans.js';
import { getAuthToken } from '../lib/http.js';
import {
  changeCompanyPlanThunk,
  selectCompaniesState,
} from '../store/slices/companiesSlice.js';

/**
 * Plan choice right after sign-up. Dispatches `changeCompanyPlanThunk` to
 * `companiesSlice` so Redux updates only after the server confirms the plan.
 */
export default function ChoosePlanPage() {
  usePageSetup({
    title: 'BillBhai - Select Subscription Plan',
    styles: [CSS.dashboard, inlineCss],
    fonts: FONTS.choosePlan,
    bodyClass: 'no-sidebar',
    bodyAttrs: { 'data-app-ready': 'true' },
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { myCompany, saving: busy } = useSelector(selectCompaniesState);
  const businessId = (myCompany && myCompany.id) || localStorage.getItem('activeBusinessId') || '';
  const businessName = (myCompany && myCompany.name) || localStorage.getItem('activeBusinessName') || 'Your Business';
  const signedIn = Boolean(getAuthToken()) && localStorage.getItem('userRole') === 'admin' && Boolean(businessId);
  const [toast, setToast] = useState({ message: '', visible: false });

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
    try {
      await dispatch(changeCompanyPlanThunk({ id: businessId, plan: planKey })).unwrap();
      if (!mounted.current) return;
      setToast({ message: `${planName} activated.`, visible: true });
      redirectTimer.current = setTimeout(() => navigate('/business-welcome'), 700);
    } catch (errMessage) {
      if (!mounted.current) return;
      setToast({ message: `Could not change the plan: ${errMessage}`, visible: true });
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
