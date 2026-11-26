import useViewState from '../../hooks/useViewState.js';

const BOX = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '6px 12px',
  alignItems: 'center',
  margin: '12px 0',
};
const CODE = {
  fontFamily: 'ui-monospace, Consolas, monospace',
  fontSize: '1rem',
  padding: '2px 6px',
  borderRadius: '4px',
  background: 'var(--bg-secondary, rgba(0,0,0,0.05))',
  userSelect: 'all',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useViewState(false);
  return (
    <button
      type="button"
      className="btn btn-outline"
      style={{ padding: '2px 8px', fontSize: '0.75rem', marginLeft: '8px' }}
      onClick={() => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(text)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * Sign-in details for a new or reset account. The temporary password comes
 * from the server and is shown only here, once; it is not saved anywhere in
 * the browser.
 */
export function CredentialsMessage({ credential }) {
  return (
    <>
      {`Give these sign-in details to ${credential.name || 'the user'} in person or by private message.`}
      <div style={BOX}>
        <strong>Username</strong>
        <span>
          <span style={CODE}>{credential.username || ''}</span>
          {credential.username && <CopyButton text={credential.username} />}
        </span>
        {credential.password && (
          <>
            <strong>Temporary password</strong>
            <span>
              <span style={CODE}>{credential.password}</span>
              <CopyButton text={credential.password} />
            </span>
          </>
        )}
        {credential.role && (
          <>
            <strong>Role</strong>
            <span>{credential.role}</span>
          </>
        )}
      </div>
      <span className="text-sm text-muted">
        This password is shown only once. Ask them to change it from Profile after signing in. If it is lost, use
        Reset password.
      </span>
    </>
  );
}

export function openCredentialsModal(openConfirm, title, credential) {
  if (!credential) return;
  openConfirm({
    title,
    message: <CredentialsMessage credential={credential} />,
    confirmLabel: 'Done',
    onConfirm: () => true,
  });
}
