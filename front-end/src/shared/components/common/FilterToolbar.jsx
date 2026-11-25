export default function FilterToolbar({ filters = [], style, children }) {
  return (
    <div className="card-bd table-toolbar" style={style}>
      {filters.map((filter) => (
        <div className="toolbar-group" key={filter.id}>
          <label className="toolbar-label" htmlFor={filter.id}>
            {filter.label}
          </label>
          <FilterSelect
            id={filter.id}
            value={filter.value}
            onChange={filter.onChange}
            options={filter.options}
          />
        </div>
      ))}
      {children}
    </div>
  );
}

export function FilterSelect({ id, value, onChange, options = [] }) {
  return (
    <select
      id={id}
      className="toolbar-select"
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
    >
      {options.map((opt) => {
        const o = typeof opt === 'object' && opt !== null ? opt : { value: opt, label: opt };
        return (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        );
      })}
    </select>
  );
}
