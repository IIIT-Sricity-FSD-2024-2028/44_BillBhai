import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchInventoryReportThunk,
  fetchReturnsReportThunk,
  fetchSalesReportThunk,
  selectInventoryReport,
  selectReportsError,
  selectReportsLoading,
  selectReturnsReport,
  selectSalesReportFor,
} from '../../store/slices/reportsSlice.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { addDays, dayKey, scopedCompanyId } from '../orders/orderFormat.js';

const REPORT_CONFIG = {
  '/reports/sales': {
    key: 'sales',
    thunk: fetchSalesReportThunk,
    selector: (state, from, to) => selectSalesReportFor(state, from, to),
  },
  '/reports/inventory': {
    key: 'inventory',
    thunk: fetchInventoryReportThunk,
    selector: selectInventoryReport,
  },
  '/reports/returns': {
    key: 'returns',
    thunk: fetchReturnsReportThunk,
    selector: selectReturnsReport,
  },
};

/**
 * Loads a server report (/reports/sales, /reports/inventory, /reports/returns)
 * for a date range, and loads it again whenever the store refreshes, so the
 * figures follow new sales without a page reload.
 */
export function useReport(path, range, { enabled = true } = {}) {
  const dispatch = useDispatch();
  const { state, lastSyncedAt } = useDashboard();
  const companyId = scopedCompanyId(state);
  const from = range && range.from;
  const to = range && range.to;

  const config = REPORT_CONFIG[path];
  if (!config) throw new Error(`useReport: unknown report ${path}`);
  const data = useSelector((reduxState) => config.selector(reduxState, from, to));
  const loadingMap = useSelector(selectReportsLoading);
  const loading = Boolean(loadingMap?.[config.key]);
  const error = useSelector(selectReportsError) || '';

  useEffect(() => {
    if (!enabled) return undefined;
    const target = REPORT_CONFIG[path];
    if (!target) return undefined;
    dispatch(target.thunk({ companyId, from: from || undefined, to: to || undefined }));
    return undefined;
  }, [dispatch, path, companyId, from, to, enabled, lastSyncedAt]);

  return { data, error, loading };
}

/** byDay rows for every day in [from, to], with empty days filled in as zero. */
export function fillDays(byDay, from, to) {
  const map = new Map((byDay || []).map((d) => [d.day, d]));
  const out = [];
  if (!from || !to) return byDay || [];
  for (let d = new Date(`${from}T00:00:00`); dayKey(d) <= to; d = addDays(d, 1)) {
    const key = dayKey(d);
    out.push(map.get(key) || { day: key, orders: 0, gross: 0, refunds: 0, net: 0, discount: 0 });
    if (out.length > 400) break;
  }
  return out;
}
