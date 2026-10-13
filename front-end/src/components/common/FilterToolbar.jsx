/**
 * Filter/sort toolbar. Holds no state: every select is controlled by the page.
 *
 *   <section className="card" style={{ marginBottom: '14px' }}>
 *     <FilterToolbar filters={[
 *       { id: 'ordersStatusFilter', label: 'Status', value: status, onChange: setStatus,
 *         options: [{ value: 'all', label: 'All statuses' }, ...statuses] },   // strings are value=label
 *     ]} />
 *   </section>
 *
 * Renders <div class="card-bd table-toolbar" style={style}> + one
 * <div class="toolbar-group"><label class="toolbar-label" for={id}>..</label><select id class="toolbar-select">
 * per filter, followed by `children` (for extra controls such as chart tabs).
 * `onChange` receives the new value (string).
 */
export default function FilterToolbar({ filters = [], style, children }) {
  return (
    <div className="card-bd table-toolbar" style={style}>
      {filters.map((filter) => (
        <div className="toolbar-group" key={filter.id}>
          <label className="toolbar-label" htmlFor={filter.id}>{filter.label}</label>
          <FilterSelect id={filter.id} value={filter.value} onChange={filter.onChange} options={filter.options} />
        </div>
      ))}
      {children}
    </div>
  );
}

/** Bare `<select class="toolbar-select">` (e.g. the delivery/returns sort selects). */
export function FilterSelect({ id, value, onChange, options = [] }) {
  return (
    <select id={id} className="toolbar-select" value={value} onChange={(e) => onChange && onChange(e.target.value)}>
      {options.map((opt) => {
        const o = typeof opt === 'object' && opt !== null ? opt : { value: opt, label: opt };
        return <option key={o.value} value={o.value}>{o.label}</option>;
      })}
    </select>
  );
}
