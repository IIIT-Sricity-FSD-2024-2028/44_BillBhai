import { useState } from 'react';
import { validatePasswordCriteria } from '../../lib/dashboard/helpers.js';

export default function SecurityCard({
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onUpdate,
  isUpdating = false,
}) {
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;
    onNewPasswordChange(value);

    if (newPasswordError) {
      if (!value) {
        setNewPasswordError('Please enter a new password.');
      } else {
        const err = validatePasswordCriteria(value);
        setNewPasswordError(err || '');
      }
    }

    if (confirmPassword) {
      if (value !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match.');
      } else {
        setConfirmPasswordError('');
      }
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    onConfirmPasswordChange(value);

    if (!newPassword) {
      setNewPasswordError('Please enter a new password first.');
      setConfirmPasswordError('Please enter new password first before confirming.');
      return;
    }

    if (value && value !== newPassword) {
      setConfirmPasswordError('Passwords do not match.');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let hasErr = false;

    if (!newPassword) {
      setNewPasswordError('Please enter a new password.');
      hasErr = true;
    } else {
      const criteriaErr = validatePasswordCriteria(newPassword);
      if (criteriaErr) {
        setNewPasswordError(criteriaErr);
        hasErr = true;
      } else {
        setNewPasswordError('');
      }
    }

    if (!newPassword) {
      setConfirmPasswordError('Please enter new password first.');
      hasErr = true;
    } else if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      hasErr = true;
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError('Passwords do not match.');
      hasErr = true;
    } else {
      setConfirmPasswordError('');
    }

    if (hasErr) return;

    setNewPasswordError('');
    setConfirmPasswordError('');
    onUpdate();
  };

  return (
    <div className="card">
      <div className="card-hd">
        <h3>Security</h3>
      </div>
      <div className="card-bd">
        <form onSubmit={handleSubmit}>
          <div className={newPasswordError ? 'form-group has-error' : 'form-group'}>
            <label className="form-label" htmlFor="psNewPassword">
              New Password
            </label>
            <input
              type="password"
              id="psNewPassword"
              className={newPasswordError ? 'form-control error' : 'form-control'}
              placeholder="Min 6 chars (letter and number)"
              value={newPassword}
              onChange={handleNewPasswordChange}
              disabled={isUpdating}
            />
            {newPasswordError ? (
              <div className="form-error" style={{ display: 'block' }}>
                {newPasswordError}
              </div>
            ) : (
              <small
                className="text-muted"
                style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem' }}
              >
                Minimum 6 characters, including 1 letter and 1 number.
              </small>
            )}
          </div>
          <div className={confirmPasswordError ? 'form-group has-error' : 'form-group'}>
            <label className="form-label" htmlFor="psConfirmPassword">
              Confirm Password
            </label>
            <input
              type="password"
              id="psConfirmPassword"
              className={confirmPasswordError ? 'form-control error' : 'form-control'}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              disabled={isUpdating}
            />
            {confirmPasswordError ? (
              <div className="form-error" style={{ display: 'block' }}>
                {confirmPasswordError}
              </div>
            ) : null}
          </div>
          <button
            type="submit"
            className="btn btn-outline"
            id="psPasswordBtn"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
