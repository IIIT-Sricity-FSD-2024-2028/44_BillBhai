import { Link } from 'react-router-dom';
import PageHeader from '../common/PageHeader.jsx';
import { LockIcon } from '../common/icons.jsx';
import { openPlanUpgradeModal } from '../../lib/dashboard/store.js';

/** Port of renderPlanFeatureLock(featureName) - the Starter-plan paywall. */
export default function PlanFeatureLock({ featureName }) {
  return (
    <>
      <PageHeader title={featureName} />
      <div className="plan-locked-container">
        <div className="plan-locked-card">
          <div className="plan-locked-icon">{LockIcon}</div>
          <h3 className="plan-locked-title">{`${featureName} is a Pro Feature`}</h3>
          <p className="plan-locked-desc">
            {'Your current '}<strong>Starter Plan</strong>{' is limited to in-store POS checkout. Upgrade to '}<strong>Growth / Pro Plan</strong>{' to unlock rider dispatches, delivery tracking, return inspections, and discount campaigns.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => openPlanUpgradeModal()}>Upgrade to Pro (₹1,999/mo)</button>
            <Link to="/dashboard" className="btn btn-outline">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    </>
  );
}
