// "Remember me" checkbox + "Forgot password?" link.
export default function FormOptions({ rememberMe, onToggleRemember, onForgotClick }) {
  return (
    <div className="form-options">
      <label className="custom-checkbox">
        <input type="checkbox" name="remember" id="remember" checked={rememberMe} onChange={onToggleRemember} />
        <span className="checkbox-box"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
        <span className="checkbox-label">Remember me</span>
      </label>
      <a
        href="#"
        className="forgot-link"
        onClick={(e) => {
          e.preventDefault();
          onForgotClick();
        }}
      >
        Forgot password?
      </a>
    </div>
  );
}
