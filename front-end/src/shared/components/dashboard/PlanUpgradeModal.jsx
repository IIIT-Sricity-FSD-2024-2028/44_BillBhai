import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import { PlanCheckIcon, PlanCrossIcon } from '../common/icons.jsx';
import { formatCurrency } from '../../lib/currency.js';
import { PLAN_DEFINITIONS } from '../../lib/dashboard/constants.js';
import { getActiveCompanyPlan, switchCompanyPlan } from '../../lib/dashboard/store.js';

export default function PlanUpgradeModal({ onClose }) {
  const currentPlan = getActiveCompanyPlan();
  const plans = [PLAN_DEFINITIONS.starter, PLAN_DEFINITIONS.pro, PLAN_DEFINITIONS.enterprise];
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirmSwitch = async () => {
    if (!confirmPlan || busy) return;
    setBusy(true);
    setError('');
    const res = await switchCompanyPlan(confirmPlan.key);
    setBusy(false);
    if (res && res.ok) {
      onClose();
    } else {
      setError((res && res.message) || 'Could not change plan.');
    }
  };

  return (
    <Modal title="Subscription & Pricing Plans" onClose={onClose} maxWidth="780px">
      <div className="modal-body">
        {confirmPlan ? (
          <div style={{ padding: '8px 4px' }}>
            <h4 style={{ marginBottom: '8px' }}>Confirm plan change</h4>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
              Switch from <strong>{currentPlan.name}</strong> to <strong>{confirmPlan.name}</strong> (
              {confirmPlan.price === 0 ? 'Free' : `${formatCurrency(confirmPlan.price)}/month`})?
            </p>
            {confirmPlan.price > 0 && (
              <p className="text-muted" style={{ fontSize: '0.84rem', marginBottom: '14px' }}>
                Monthly billing of {formatCurrency(confirmPlan.price)} will be added to your business subscription.
              </p>
            )}
            {error && (
              <div className="alert-banner" style={{ color: 'var(--red)', marginBottom: '12px', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setConfirmPlan(null); setError(''); }}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={confirmSwitch}>
                {busy ? 'Updating…' : confirmPlan.price > 0 ? `Confirm ${formatCurrency(confirmPlan.price)}/mo plan` : 'Confirm Switch'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.88rem' }}>
              Select a plan that fits your business scale. Changes take effect immediately.
            </p>
            <div className="subscription-plans-grid">
              {plans.map((p) => {
                const isCurrent = p.key === currentPlan.key;
                const shortName = p.name.split('/')[0].trim();
                return (
                  <div
                    className={`plan-tier-card ${isCurrent ? 'current' : ''} ${p.key === 'pro' ? 'popular' : ''}`}
                    key={p.key}
                  >
                    {p.key === 'pro' && <div className="plan-popular-pill">Most Popular</div>}
                    <div className="plan-tier-name">{p.name}</div>
                    <div className="plan-tier-price">
                      {p.price === 0 ? (
                        <>
                          {formatCurrency(0)}<span>/Free</span>
                        </>
                      ) : (
                        <>
                          {formatCurrency(p.price)}
                          <span>/mo</span>
                        </>
                      )}
                    </div>
                    <ul className="plan-tier-features">
                      <li>
                        {PlanCheckIcon}
                        {` ${p.limits.maxUsers === Infinity ? 'Unlimited' : `Up to ${p.limits.maxUsers}`} Users${p.key === 'starter' ? ' (Owner + 1 staff)' : ''}`}
                      </li>
                      <li>
                        {PlanCheckIcon}
                        {` ${p.limits.maxStores === Infinity ? 'Unlimited' : `Up to ${p.limits.maxStores}`} Store${p.limits.maxStores > 1 ? 's' : ''}`}
                      </li>
                      <li>
                        {PlanCheckIcon}
                        {` ${p.limits.maxProducts === Infinity ? 'Unlimited' : `Up to ${p.limits.maxProducts.toLocaleString()}`} Products`}
                      </li>
                      <li className={p.features.discounts ? '' : 'disabled'}>
                        {p.features.discounts ? PlanCheckIcon : PlanCrossIcon}
                        {' Coupons & Discounts'}
                      </li>
                      <li className={p.features.delivery ? '' : 'disabled'}>
                        {p.features.delivery ? PlanCheckIcon : PlanCrossIcon}
                        {' Delivery Operations'}
                      </li>
                      <li className={p.features.returns ? '' : 'disabled'}>
                        {p.features.returns ? PlanCheckIcon : PlanCrossIcon}
                        {' Returns & Refunds'}
                      </li>
                    </ul>
                    <button
                      className={`btn ${isCurrent ? 'btn-outline' : p.key === 'pro' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }}
                      disabled={isCurrent}
                      data-choose-plan={p.key}
                      onClick={() => { setError(''); setConfirmPlan(p); }}
                    >
                      {isCurrent
                        ? 'Current Plan'
                        : p.price > currentPlan.price
                          ? `Upgrade to ${shortName}`
                          : `Switch to ${shortName}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
