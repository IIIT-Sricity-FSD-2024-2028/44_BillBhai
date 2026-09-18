/**
 * Form field wrapper used by every form/dialog:
 *   <div class="form-group[ has-error]"><label class="form-label" for={htmlFor}>{label}</label>
 *     {control}<div class="form-error">{error}</div><div class="form-hint">{hint}</div></div>
 *
 * Props
 *  label, htmlFor  label text / `for`.
 *  error           static error text (renders .form-error; omit for fields without one).
 *  invalid         undefined -> untouched (no inline style, like the static HTML)
 *                  true      -> setFieldError(): `.has-error` + error `display:block`
 *                  false     -> clearFieldError(): error `display:none`
 *                  (also give the control `className={controlClass(invalid)}`).
 *  hasError, errorDisplay
 *                  finer control for the static page modals (#newOrderModal,
 *                  #addUserModal, #addProductModal), which toggle the
 *                  `.has-error` class separately from the error's inline
 *                  `display` ('block' | 'none' | undefined). Ignored when
 *                  `invalid` is given.
 *  errorMessage    overrides the error text (setFieldError(id, message)).
 *  hint            renders <div class="form-hint">.
 *  hintFirst       renders the hint before the error (inventory Lead Time field).
 */
export default function FormField({
  label, htmlFor, error, invalid, hasError = false, errorDisplay, errorMessage, hint, hintFirst = false, children,
}) {
  const groupHasError = invalid !== undefined ? invalid === true : hasError;
  const display = invalid === true ? 'block' : invalid === false ? 'none' : errorDisplay;
  const errorEl = error !== undefined
    ? <div className="form-error" style={display ? { display } : undefined}>{errorMessage || error}</div>
    : null;
  const hintEl = hint !== undefined ? <div className="form-hint">{hint}</div> : null;
  return (
    <div className={groupHasError ? 'form-group has-error' : 'form-group'}>
      <label className="form-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hintFirst ? hintEl : errorEl}
      {hintFirst ? errorEl : hintEl}
    </div>
  );
}

/** `form-control` + ` error` while the field is flagged. */
export function controlClass(hasError) {
  return hasError ? 'form-control error' : 'form-control';
}
