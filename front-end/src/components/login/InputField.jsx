function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
  );
}

/**
 * One `.input-group` (username or password). `status` is `{ error, shake }`;
 * the shake class is dropped when its animation ends, like script.js did.
 */
export default function InputField({
  id,
  name,
  type,
  placeholder,
  icon,
  value,
  status,
  showPassword,
  onChange,
  onFocus,
  onShakeEnd,
  onTogglePassword,
}) {
  const isPassword = type === 'password';
  const className = ['input-group', status.error && 'error', status.shake && 'shake'].filter(Boolean).join(' ');

  return (
    <div className={className} id={`${id}Group`} onAnimationEnd={status.shake ? onShakeEnd : undefined}>
      <input
        type={isPassword && showPassword ? 'text' : type}
        id={id}
        name={name}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
      />
      <label htmlFor={id}>
        {icon === 'user' ? <UserIcon /> : <LockIcon />}
        <span>{placeholder}</span>
      </label>
      <div className="input-highlight"></div>
      {isPassword && (
        <button
          type="button"
          className={`toggle-password${showPassword ? ' showing' : ''}`}
          id="togglePassword"
          aria-label="Show password"
          onClick={onTogglePassword}
        >
          <svg className="eye-open" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          <svg className="eye-closed" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
        </button>
      )}
    </div>
  );
}
