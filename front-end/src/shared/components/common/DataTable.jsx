import { useEffect } from 'react';
import useViewState from '../../hooks/useViewState.js';

/**
 * Table used on every dashboard page. Pass `pageSize` to show long lists one
 * page at a time; going to another filter result starts again from page 1.
 */
export default function DataTable({
  columns = [],
  rows = [],
  renderRow,
  getRowKey,
  emptyMessage,
  emptyColSpan,
  tbodyId,
  pageSize,
}) {
  const size = Number(pageSize) || 0;
  const [page, setPage] = useViewState(1);
  useEffect(() => setPage(1), [rows.length, setPage]);

  const pageCount = size ? Math.max(1, Math.ceil(rows.length / size)) : 1;
  const current = Math.min(page, pageCount);
  const start = size ? (current - 1) * size : 0;
  const shown = size ? rows.slice(start, start + size) : rows;

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
    body = shown.map((row, index) => renderRow(row, start + index));
  } else {
    body = shown.map((row, index) => (
      <tr key={keyOf(row, start + index)}>
        {columns.map((col, ci) => {
          const cellCls =
            typeof col.cellClassName === 'function' ? col.cellClassName(row) : col.cellClassName;
          const content = col.render ? col.render(row, start + index) : row[col.key];
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
    <>
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
      {size > 0 && rows.length > size && (
        <nav className="dt-pager" aria-label="Table pages">
          <span className="text-sm text-muted">
            Showing {start + 1}–{Math.min(start + size, rows.length)} of {rows.length}
          </span>
          <div className="dt-pager-buttons">
            <button type="button" className="btn btn-outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              Previous
            </button>
            <span className="text-sm">
              Page {current} of {pageCount}
            </span>
            <button type="button" className="btn btn-outline" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
              Next
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
