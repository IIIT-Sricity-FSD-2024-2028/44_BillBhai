import { ChevronDownIcon, FIELD_ICONS } from './icons.jsx';
import { fieldErrorStyle, groupClassName } from './groupUtils.js';

const BUSINESS_TYPES = [
  ['retail', 'Retail Store'],
  ['wholesale', 'Wholesale'],
  ['restaurant', 'Restaurant / Cafe'],
  ['grocery', 'Grocery / Kirana'],
  ['electronics', 'Electronics'],
  ['clothing', 'Clothing / Fashion'],
  ['pharmacy', 'Pharmacy / Medical'],
  ['services', 'Services'],
  ['other', 'Other'],
];

export default function BusinessTypeSelect({ value, status, onChange, onFocus, onShakeEnd }) {
  return (
    <div className={groupClassName(status)} id="businessTypeGroup" onAnimationEnd={status.shake ? onShakeEnd : undefined}>
      <select id="businessType" name="businessType" required value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus}>
        <option value="" disabled>Business Type</option>
        {BUSINESS_TYPES.map(([key, text]) => (
          <option key={key} value={key}>{text}</option>
        ))}
      </select>
      <label htmlFor="businessType">
        {FIELD_ICONS.list}
        <span>Business Type</span>
      </label>
      <div className="select-arrow">
        <ChevronDownIcon />
      </div>
      <div className="input-highlight"></div>
      <div className="field-error" style={fieldErrorStyle(status)}>{status.errText}</div>
    </div>
  );
}
