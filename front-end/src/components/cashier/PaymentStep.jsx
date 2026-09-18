// STEP 4: Payment Mock Flow (ui.js renderCheckoutSummary()).
export default function PaymentStep({ active, title, subtitle, summary, resetLabel, onReset }) {
  return (
    <div id="step-4-payment" className={`step-container${active ? ' active' : ''}`}>
      <div className="wizard-centered success-block">
        <div className="success-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
        </div>
        <h3 id="paymentStepTitle">{title}</h3>
        <p className="text-muted" id="paymentStepSubtitle" style={{ marginBottom: '30px', fontSize: '0.95rem' }}>
          {subtitle}
        </p>
        <div id="paymentOutcomeSummary" className="checkout-summary-card" style={{ display: summary ? 'grid' : 'none' }}>
          {summary && summary.map((row) => (
            <div key={row.label} className="checkout-summary-row"><span>{row.label}</span><strong>{row.value}</strong></div>
          ))}
        </div>
        <button className="btn btn-primary" id="btnResetFlow" style={{ justifyContent: 'center' }} onClick={onReset}>
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
