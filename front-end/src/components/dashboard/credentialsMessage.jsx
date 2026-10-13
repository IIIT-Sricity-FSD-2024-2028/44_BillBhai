export function CredentialsMessage({ credential }) {
  return (
    <>
      {`Share these credentials with ${credential.name || ''}:`}
      <br />
      <br />
      <strong>Username:</strong>
      {` ${credential.username || ''}`}
      <br />
      <strong>Password:</strong>
      {` ${credential.password || ''}`}
      <br />
      <strong>Role:</strong>
      {` ${credential.role || ''}`}
      <br />
      <strong>Email:</strong>
      {` ${credential.email || '-'}`}
    </>
  );
}

export function openCredentialsModal(openConfirm, title, credential) {
  if (!credential) return;
  openConfirm({
    title,
    message: <CredentialsMessage credential={credential} />,
    confirmLabel: 'Done',
    onConfirm: () => {},
  });
}
