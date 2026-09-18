// "Subscription & Plan" card (admin / superuser only), as rendered by
// renderProfileSettingsUnified(). Note: this is NOT updateProfileSubscriptionCard()
// (that one targeted ids of the static profile.html markup, which renderPage
// replaces) - so price is not locale-formatted, the renewal date and the
// "Active" badge are fixed, stores are always 1 and percentages are unrounded
// with no warning/danger classes, exactly like the original.
function planBadgeClass(planKey) {
  if (planKey === 'starter') return 'b-pending';
  if (planKey === 'enterprise') return 'b-processing';
  return 'b-active';
}

function QuotaMeter({ label, count, max, style }) {
  const maxText = max === Infinity ? 'Unlimited' : max;
  const pct = max === Infinity ? 0 : Math.min(100, (count / max) * 100);
  return (
    <div className="quota-meter" style={style}>
      <div className="quota-meter-header">
        <span className="quota-meter-label">{label}</span>
        <span className="quota-meter-count">{`${count} / ${maxText} Used`}</span>
      </div>
      <div className="quota-meter-bar"><div className="quota-meter-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function SubscriptionPlanCard({ plan, usersCount, productsCount, onUpgrade, onCancel }) {
  return (
    <div className="card">
      <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Subscription &amp; Plan</h3>
        <span className={`badge ${planBadgeClass(plan.key)}`} style={{ padding: '5px 12px' }}>{plan.name}</span>
      </div>
      <div className="card-bd">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{`₹${plan.price}`}<small style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)' }}>/month</small></div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Renews on 30 Sept 2026</div>
          </div>
          <span className="badge b-active">Active</span>
        </div>
        <QuotaMeter label="Team Members" count={usersCount} max={plan.limits.maxUsers} style={{ marginTop: '16px' }} />
        <QuotaMeter label="Product Catalog" count={productsCount} max={plan.limits.maxProducts} />
        <QuotaMeter label="Store Locations" count={1} max={plan.limits.maxStores} />
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onUpgrade}>Upgrade / Change Plan</button>
          <button className="btn btn-outline" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={onCancel}>Cancel Plan</button>
        </div>
      </div>
    </div>
  );
}
