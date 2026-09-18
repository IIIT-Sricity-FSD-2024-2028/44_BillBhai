// "Security" card: new/confirm password + Update Password button.
// Values are controlled by the parent; `onUpdate` runs the psPasswordBtn logic.
export default function SecurityCard({ newPassword, confirmPassword, onNewPasswordChange, onConfirmPasswordChange, onUpdate }) {
  return (
    <div className="card">
      <div className="card-hd"><h3>Security</h3></div>
      <div className="card-bd">
        <div className="form-group"><label className="form-label">New Password</label><input type="password" id="psNewPassword" className="form-control" placeholder="Minimum 6 characters" value={newPassword} onChange={(e) => onNewPasswordChange(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Confirm Password</label><input type="password" id="psConfirmPassword" className="form-control" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => onConfirmPasswordChange(e.target.value)} /></div>
        <button className="btn btn-outline" id="psPasswordBtn" style={{ width: '100%', justifyContent: 'center' }} onClick={onUpdate}>Update Password</button>
      </div>
    </div>
  );
}
