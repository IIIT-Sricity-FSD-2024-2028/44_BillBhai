const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const CLASSES = ['', '', 'medium', 'medium', 'strong'];

// Score 0-5 mapped to level 0-4, exactly as register.js computed it.
function strengthLevel(val) {
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  return Math.min(score, 4);
}

export default function PasswordStrength({ password }) {
  const level = strengthLevel(password);
  return (
    <>
      <div className="password-strength">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={['strength-bar', i < level && 'active', i < level && CLASSES[level]].filter(Boolean).join(' ')}
          ></div>
        ))}
      </div>
      <span className="strength-label">{password ? LABELS[level] || '' : ''}</span>
    </>
  );
}
