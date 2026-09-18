// Submit button with its three states: text -> spinner (loading) -> tick (success).
export default function LoginButton({ isLoading, isSuccess }) {
  const className = ['btn-login', isLoading && 'loading', isSuccess && 'success'].filter(Boolean).join(' ');
  return (
    <button type="submit" className={className} id="btnLogin" disabled={isLoading || isSuccess}>
      <span className="btn-text">Sign In</span>
      <span className="btn-loader"><svg className="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle></svg></span>
      <span className="btn-success"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg></span>
    </button>
  );
}
