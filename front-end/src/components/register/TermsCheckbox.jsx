import { CheckIcon } from './icons.jsx';

export default function TermsCheckbox({ checked, onChange }) {
  return (
    <label className="custom-checkbox">
      <input type="checkbox" id="agreeTerms" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="checkbox-box">
        <CheckIcon />
      </span>
      <span className="checkbox-text">I agree to the <a href="#">Terms &amp; Conditions</a> and <a href="#">Privacy Policy</a></span>
    </label>
  );
}
