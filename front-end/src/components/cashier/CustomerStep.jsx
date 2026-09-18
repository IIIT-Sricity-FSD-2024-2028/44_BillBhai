const ERROR_STYLE = { display: 'block', color: 'var(--red)', fontSize: '0.8rem', marginTop: '4px' };

// STEP 1: Customer Info
export default function CustomerStep({
  active,
  copy,
  lookupHint,
  customer,
  errors,
  onFieldChange,
  onPhoneChange,
  onPhoneBlur,
  onSubmit,
}) {
  return (
    <div id="step-1-customer" className={`step-container${active ? ' active' : ''}`}>
      <div className="wizard-centered">
        <h3 id="checkoutStepTitle">{copy.stepTitle}</h3>
        <p className="text-muted" id="checkoutStepSubtitle" style={{ marginBottom: '20px', fontSize: '0.9rem' }}>{copy.stepSubtitle}</p>
        <form id="customerForm" noValidate onSubmit={onSubmit}>
          <div id="customerLookupHint" className={lookupHint.className} style={{ marginBottom: '12px' }}>{lookupHint.text}</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cName">Customer Name *</label>
              <input type="text" className="form-control" id="cName" placeholder="Enter full name" value={customer.name} onChange={(e) => onFieldChange('name', e.target.value)} />
              <div className="form-error" id="errName" style={ERROR_STYLE}>{errors.name}</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cPhone">Phone Number *</label>
              <input type="tel" className="form-control" id="cPhone" placeholder="10-digit number" maxLength={10} inputMode="numeric" value={customer.phone} onChange={(e) => onPhoneChange(e.target.value)} onBlur={onPhoneBlur} />
              <div className="form-error" id="errPhone" style={ERROR_STYLE}>{errors.phone}</div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cEmail">Email</label>
              <input type="email" className="form-control" id="cEmail" placeholder="customer@email.com" value={customer.email} onChange={(e) => onFieldChange('email', e.target.value)} />
              <div className="form-error" id="errEmail" style={ERROR_STYLE}>{errors.email}</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cNotes">Customer Notes (Optional)</label>
            <input type="text" className="form-control" id="cNotes" placeholder="Preferences, landmark, etc." value={customer.notes} onChange={(e) => onFieldChange('notes', e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" id="customerStepSubmitBtn" style={{ width: '100%', justifyContent: 'center' }}>{copy.submitLabel}</button>
        </form>
      </div>
    </div>
  );
}
