import { FIELD_ICONS, EyeClosedIcon, EyeOpenIcon } from './icons.jsx';
import { fieldErrorStyle, groupClassName } from './groupUtils.js';

/**
 * A text/email/tel/password `.input-group`. Password fields get the
 * show/hide toggle; the optional GSTIN field gets the "Optional" tag and
 * has no `.field-error`.
 */
export default function RegisterField({
  id,
  type = 'text',
  placeholder,
  label = placeholder,
  icon,
  value,
  status,
  optional = false,
  showing = false,
  inputProps = {},
  onChange,
  onFocus,
  onShakeEnd,
  onToggle,
}) {
  const isPassword = type === 'password';
  return (
    <div className={groupClassName(status)} id={`${id}Group`} onAnimationEnd={status.shake ? onShakeEnd : undefined}>
      <input
        type={isPassword && showing ? 'text' : type}
        id={id}
        name={id}
        required={!optional}
        placeholder={placeholder}
        {...inputProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
      />
      <label htmlFor={id}>
        {FIELD_ICONS[icon]}
        <span>{label}</span>
      </label>
      {optional && <span className="optional-tag">Optional</span>}
      <div className="input-highlight"></div>
      {isPassword && (
        <button type="button" className={`toggle-password${showing ? ' showing' : ''}`} aria-label="Show password" onClick={onToggle}>
          <EyeOpenIcon />
          <EyeClosedIcon />
        </button>
      )}
      {!optional && <div className="field-error" style={fieldErrorStyle(status)}>{status.errText}</div>}
    </div>
  );
}
