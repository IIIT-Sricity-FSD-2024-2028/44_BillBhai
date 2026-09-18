/**
 * Port of dashboard.js table(hdrs, rows):
 *   <div class="tbl-wrap"><table class="dt"><thead><tr><th>..</th></tr></thead><tbody>..</tbody></table></div>
 *
 * Props
 *  columns      array of headers. Each item is a string/node (header only) or
 *               { header, key?, render?(row, index), cellClassName? (string | (row) => string) }.
 *  rows         array of data rows.
 *  renderRow    optional (row, index) => <tr>..</tr> for rows that need custom markup.
 *               When omitted, each row renders one <td> per column using
 *               column.render(row, i) or row[column.key].
 *  getRowKey    optional (row, index) => key (default: row.id ?? row.sku ?? index).
 *  emptyMessage when rows is empty, renders
 *               <tr><td colspan={emptyColSpan ?? columns.length} class="text-muted">{emptyMessage}</td></tr>
 *               (omit it to render an empty <tbody>, like the original `table(h, '')`).
 *  tbodyId      id for <tbody> (e.g. "ordersTableBodyDyn").
 */
export default function DataTable({ columns = [], rows = [], renderRow, getRowKey, emptyMessage, emptyColSpan, tbodyId }) {
  const keyOf = getRowKey || ((row, index) => (row && (row.id ?? row.sku)) ?? index);
  const headerOf = (col) => (col && typeof col === 'object' && !Array.isArray(col) && 'header' in col ? col.header : col);

  let body;
  if (!rows.length) {
    body = emptyMessage !== undefined
      ? <tr><td colSpan={emptyColSpan ?? columns.length} className="text-muted">{emptyMessage}</td></tr>
      : null;
  } else if (renderRow) {
    body = rows.map((row, index) => renderRow(row, index));
  } else {
    body = rows.map((row, index) => (
      <tr key={keyOf(row, index)}>
        {columns.map((col, ci) => {
          const cellCls = typeof col.cellClassName === 'function' ? col.cellClassName(row) : col.cellClassName;
          const content = col.render ? col.render(row, index) : row[col.key];
          return <td key={ci} className={cellCls || undefined}>{content}</td>;
        })}
      </tr>
    ));
  }

  return (
    <div className="tbl-wrap">
      <table className="dt">
        <thead><tr>{columns.map((col, i) => <th key={i}>{headerOf(col)}</th>)}</tr></thead>
        <tbody id={tbodyId}>{body}</tbody>
      </table>
    </div>
  );
}
