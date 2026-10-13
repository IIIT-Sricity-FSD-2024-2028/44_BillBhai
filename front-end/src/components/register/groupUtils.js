export const EMPTY_GROUP = { error: false, shake: false, errText: '', errDisplay: '' };

export function groupClassName(status) {
  return ['input-group', status.error && 'error', status.shake && 'shake']
    .filter(Boolean)
    .join(' ');
}

export function fieldErrorStyle(status) {
  return status.errDisplay ? { display: status.errDisplay } : undefined;
}
