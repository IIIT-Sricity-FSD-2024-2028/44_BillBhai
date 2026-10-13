export default function DataTable({
  columns = [],
  rows = [],
  renderRow,
  getRowKey,
  emptyMessage,
  emptyColSpan,
  tbodyId,
}) {
  const keyOf = getRowKey || ((row, index) => (row && (row.id ?? row.sku)) ?? index);
  const headerOf = (col) =>
    col && typeof col === 'object' && !Array.isArray(col) && 'header' in col ? col.header : col;

  let body;
  if (!rows.length) {
    body =
      emptyMessage !== undefined ? (
        <tr>
          <td colSpan={emptyColSpan ?? columns.length} className="text-muted">
            {emptyMessage}
          </td>
        </tr>
      ) : null;
  } else if (renderRow) {
    body = rows.map((row, index) => renderRow(row, index));
  } else {
    body = rows.map((row, index) => (
      <tr key={keyOf(row, index)}>
        {columns.map((col, ci) => {
          const cellCls =
            typeof col.cellClassName === 'function' ? col.cellClassName(row) : col.cellClassName;
          const content = col.render ? col.render(row, index) : row[col.key];
          return (
            <td key={ci} className={cellCls || undefined}>
              {content}
            </td>
          );
        })}
      </tr>
    ));
  }

  return (
    <div className="tbl-wrap">
      <table className="dt">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{headerOf(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody id={tbodyId}>{body}</tbody>
      </table>
    </div>
  );
}
