import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import usePageSetup from '../hooks/usePageSetup.js';
import { FONTS } from '../lib/pageAssets.js';
import inlineCss from '../styles/business-welcome-inline.css?inline';
import InfoRow from '../components/businessWelcome/InfoRow.jsx';
import WelcomeActions from '../components/businessWelcome/WelcomeActions.jsx';
import { getAuthToken } from '../lib/http.js';
import { loadObject } from '../lib/dashboard/storage.js';
import {
  fetchMyCompanyProfileThunk,
  selectCompaniesState,
} from '../store/slices/companiesSlice.js';

const PLAN_LABELS = {
  starter: 'Starter Plan (Free)',
  pro: 'Growth / Pro Plan (₹1,999/mo)',
  enterprise: 'Enterprise Plan (₹4,999/mo)',
};

/**
 * "Your business is ready". Reads business profile from Redux (`companiesSlice`)
 * after `fetchMyCompanyProfileThunk` succeeds against the backend.
 */
export default function BusinessWelcomePage() {
  usePageSetup({ title: 'BillBhai - Business Ready', styles: [inlineCss], fonts: FONTS.businessWelcome });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [user] = useState(() => loadObject('currentUser', {}));
  const { myCompany: company, myCompanyError: error } = useSelector(selectCompaniesState);

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login');
      return;
    }
    dispatch(fetchMyCompanyProfileThunk());
  }, [dispatch, navigate]);

  const show = (value) => value || '-';

  return (
    <main className="card">
      <h1>Your Business Is Ready</h1>
      <p className="muted">
        You are signed in as the admin. Next: add your products in Inventory and your staff in Users. Each new staff
        member gets a temporary password to change after they sign in.
      </p>
      {error && <p className="muted">Could not load the business details: {error}</p>}
      <section className="grid">
        <InfoRow label="Business ID" id="businessId" value={show(company && company.id)} />
        <InfoRow label="Business Name" id="businessName" value={show(company && company.name)} />
        <InfoRow
          label="Active Subscription"
          id="planName"
          value={company ? PLAN_LABELS[company.plan] || company.plan : '-'}
          valueStyle={{ color: '#10b981' }}
        />
        <InfoRow label="GSTIN" id="gstNo" value={show(company && company.gstNo)} />
        <InfoRow label="Owner" id="ownerName" value={show(user.name)} />
        <InfoRow label="Your username" id="username" value={show(user.username)} />
        <InfoRow label="Email" id="email" value={show(user.email)} />
      </section>
      <WelcomeActions />
    </main>
  );
}
