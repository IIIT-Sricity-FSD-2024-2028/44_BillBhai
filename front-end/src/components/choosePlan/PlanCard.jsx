function CheckIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>;
}

function CrossIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}

function Feature({ feature }) {
  return (
    <li className={feature.disabled ? 'disabled' : undefined}>
      {feature.disabled ? <CrossIcon /> : <CheckIcon />}{' '}
      {feature.strong ? <><strong>{feature.strong}</strong>{feature.rest}</> : feature.text}
    </li>
  );
}

export default function PlanCard({ plan, onSelect }) {
  return (
    <div className={`plan-onboarding-card${plan.popular ? ' popular' : ''}`}>
      {plan.popular && <div className="plan-onboarding-pill">Most Popular</div>}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: plan.kickerColor, marginBottom: '4px' }}>{plan.kicker}</div>
      <div className="plan-tier-name" style={{ fontSize: '1.25rem' }}>{plan.title}</div>
      <div className="plan-tier-price" style={{ fontSize: '1.85rem', marginBottom: '8px' }}>{plan.priceLabel}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/month</span></div>
      <p className="text-muted" style={{ fontSize: '0.82rem', lineHeight: 1.4, marginBottom: '18px', minHeight: '38px' }}>{plan.description}</p>
      <ul className="plan-tier-features" style={{ marginBottom: '24px', gap: '10px', fontSize: '0.82rem' }}>
        {plan.features.map((feature) => (
          <Feature key={feature.strong || feature.text} feature={feature} />
        ))}
      </ul>
      <button className={plan.buttonClass} style={plan.buttonStyle} onClick={() => onSelect(plan.key, plan.price, plan.name)}>
        {plan.buttonLabel}
      </button>
    </div>
  );
}
