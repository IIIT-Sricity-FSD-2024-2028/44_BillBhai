/**
 * Message body of showCredentialsModal(title, credential) - the original
 * built it as HTML:
 *   Share these credentials with NAME:<br><br><strong>Username:</strong> u<br>
 *   <strong>Password:</strong> p<br><strong>Role:</strong> r<br><strong>Email:</strong> e
 */
export function CredentialsMessage({ credential }) {
  return (
    <>
      {`Share these credentials with ${credential.name || ''}:`}
      <br />
      <br />
      <strong>Username:</strong>{` ${credential.username || ''}`}
      <br />
      <strong>Password:</strong>{` ${credential.password || ''}`}
      <br />
      <strong>Role:</strong>{` ${credential.role || ''}`}
      <br />
      <strong>Email:</strong>{` ${credential.email || '-'}`}
    </>
  );
}

/** Opens the credentials confirm dialog through `openConfirm`. */
export function openCredentialsModal(openConfirm, title, credential) {
  if (!credential) return;
  openConfirm({
    title,
    message: <CredentialsMessage credential={credential} />,
    confirmLabel: 'Done',
    onConfirm: () => {},
  });
}
