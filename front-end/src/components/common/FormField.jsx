export default function FormField({
  label,
  htmlFor,
  error,
  invalid,
  hasError = false,
  errorDisplay,
  errorMessage,
  hint,
  hintFirst = false,
  children,
}) {
  const groupHasError = invalid !== undefined ? invalid === true : hasError;
  const display = invalid === true ? 'block' : invalid === false ? 'none' : errorDisplay;
  const errorEl =
    error !== undefined ? (
      <div className="form-error" style={display ? { display } : undefined}>
        {errorMessage || error}
      </div>
    ) : null;
  const hintEl = hint !== undefined ? <div className="form-hint">{hint}</div> : null;
  return (
    <div className={groupHasError ? 'form-group has-error' : 'form-group'}>
      <label className="form-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hintFirst ? hintEl : errorEl}
      {hintFirst ? errorEl : hintEl}
    </div>
  );
}

export function controlClass(hasError) {
  return hasError ? 'form-control error' : 'form-control';
}
