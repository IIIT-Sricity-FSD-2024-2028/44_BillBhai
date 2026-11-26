import useViewState from '../../../../shared/hooks/useViewState.js';
import { CheckIcon } from './icons.jsx';

export default function TermsCheckbox({ checked, onChange }) {
  const [showTerms, setShowTerms] = useViewState(false);
  return (
    <div>
      <label className="custom-checkbox">
        <input
          type="checkbox"
          id="agreeTerms"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="checkbox-box">
          <CheckIcon />
        </span>
        <span className="checkbox-text">
          I agree to the{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setShowTerms((v) => !v);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--accent)',
              cursor: 'pointer',
              font: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Terms &amp; Conditions and Privacy Policy
          </button>
        </span>
      </label>
      {showTerms && (
        <p
          style={{
            marginTop: '6px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
          }}
        >
          Your business data, invoices, and staff accounts stay isolated to your store. Contact{' '}
          <a href="mailto:support@billbhai.in">support@billbhai.in</a> for data export or deletion.
        </p>
      )}
    </div>
  );
}
