import Modal from '../common/Modal.jsx';
import { PlanCheckIcon, PlanCrossIcon } from '../common/icons.jsx';
import { PLAN_DEFINITIONS } from '../../lib/dashboard/constants.js';
import { getActiveCompanyPlan, switchCompanyPlan } from '../../lib/dashboard/store.js';

/** Port of window.openPlanUpgradeModal(): Subscription & Pricing Plans dialog. */
export default function PlanUpgradeModal({ onClose }) {
  const currentPlan = getActiveCompanyPlan();
  const plans = [PLAN_DEFINITIONS.starter, PLAN_DEFINITIONS.pro, PLAN_DEFINITIONS.enterprise];

  const choose = async (key) => {
    onClose();
    await switchCompanyPlan(key);
  };

  return (
    <Modal title="Subscription & Pricing Plans" onClose={onClose} maxWidth="780px">
      <div className="modal-body">
        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.88rem' }}>Select a plan that fits your business scale. Changes take effect immediately.</p>
        <div className="subscription-plans-grid">
          {plans.map((p) => {
            const isCurrent = p.key === currentPlan.key;
            const shortName = p.name.split('/')[0].trim();
            return (
              <div className={`plan-tier-card ${isCurrent ? 'current' : ''} ${p.key === 'pro' ? 'popular' : ''}`} key={p.key}>
                {p.key === 'pro' && <div className="plan-popular-pill">Most Popular</div>}
                <div className="plan-tier-name">{p.name}</div>
                <div className="plan-tier-price">
                  {p.price === 0 ? <>₹0<span>/Free</span></> : <>{`₹${p.price.toLocaleString()}`}<span>/mo</span></>}
                </div>
                <ul className="plan-tier-features">
                  <li>{PlanCheckIcon}{` ${p.limits.maxUsers === Infinity ? 'Unlimited' : `Up to ${p.limits.maxUsers}`} Users`}</li>
                  <li>{PlanCheckIcon}{` ${p.limits.maxStores === Infinity ? 'Unlimited' : `Up to ${p.limits.maxStores}`} Store${p.limits.maxStores > 1 ? 's' : ''}`}</li>
                  <li>{PlanCheckIcon}{` ${p.limits.maxProducts === Infinity ? 'Unlimited' : `Up to ${p.limits.maxProducts.toLocaleString()}`} Products`}</li>
                  <li className={p.features.delivery ? '' : 'disabled'}>{p.features.delivery ? PlanCheckIcon : PlanCrossIcon}{' Delivery Operations'}</li>
                  <li className={p.features.returns ? '' : 'disabled'}>{p.features.returns ? PlanCheckIcon : PlanCrossIcon}{' Returns & Refunds'}</li>
                </ul>
                <button
                  className={`btn ${isCurrent ? 'btn-outline' : (p.key === 'pro' ? 'btn-primary' : 'btn-outline')}`}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }}
                  disabled={isCurrent}
                  data-choose-plan={p.key}
                  onClick={() => choose(p.key)}
                >
                  {isCurrent ? 'Current Plan' : (p.price > currentPlan.price ? `Upgrade to ${shortName}` : `Switch to ${shortName}`)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
