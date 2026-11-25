import { useLayoutEffect, useRef } from 'react';

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
        <option
          key={o.value}
          value={o.value}
          hidden={o.hidden || undefined}
          disabled={o.disabled || undefined}
        >
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function effectiveSelectValue(options, value) {
  return options.some((o) => (typeof o === 'object' ? o.value : o) === value) ? value : '';
}
