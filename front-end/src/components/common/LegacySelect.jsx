import { useLayoutEffect, useRef } from 'react';

/**
 * Controlled <select> that behaves like assigning `select.value` in the DOM:
 * a value with no matching <option> leaves nothing selected (selectedIndex -1)
 * instead of React's fallback to the first option. The original forms relied
 * on that (e.g. editing a product whose category is not in the list).
 * `options` are strings or { value, label, hidden, disabled }.
 */
export default function LegacySelect({ options, value, onChange, ...rest }) {
  const ref = useRef(null);
  const list = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const matches = list.some((o) => o.value === value);
  useLayoutEffect(() => {
    if (!matches && ref.current) ref.current.selectedIndex = -1;
  });
  return (
    <select ref={ref} value={matches ? value : ''} onChange={onChange} {...rest}>
      {list.map((o) => (
        <option key={o.value} value={o.value} hidden={o.hidden || undefined} disabled={o.disabled || undefined}>{o.label}</option>
      ))}
    </select>
  );
}

/** Value the original read back from a select (`''` when nothing matched). */
export function effectiveSelectValue(options, value) {
  return options.some((o) => (typeof o === 'object' ? o.value : o) === value) ? value : '';
}
