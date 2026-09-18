// State of one `.input-group`: CSS classes plus its `.field-error` text and
// inline display (register.js toggled `errEl.style.display` directly).
export const EMPTY_GROUP = { error: false, shake: false, errText: '', errDisplay: '' };

export function groupClassName(status) {
  return ['input-group', status.error && 'error', status.shake && 'shake'].filter(Boolean).join(' ');
}

export function fieldErrorStyle(status) {
  return status.errDisplay ? { display: status.errDisplay } : undefined;
}
