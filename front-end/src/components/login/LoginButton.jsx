import React from 'react';

export default function LoginButton({ isLoading, isSuccess }) {
  let buttonClasses = 'btn-login';
  if (isLoading) buttonClasses += ' loading';
  if (isSuccess) buttonClasses += ' success';

  return (
    <button
      type="submit"
      id="btnLogin"
      className={buttonClasses}
      disabled={isLoading || isSuccess}
    >
      <span className="btn-text">Sign In</span>

      <span className="btn-loader">
        <svg className="spinner" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
        </svg>
      </span>

      <span className="btn-success">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </button>
  );
}
