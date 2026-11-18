import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/dashboard/api.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { addDays, dayKey, scopedCompanyId } from '../orders/orderFormat.js';

/**
 * Loads a server report (/reports/sales, /reports/inventory, /reports/returns)
 * for a date range, and loads it again whenever the store refreshes, so the
 * figures follow new sales without a page reload.
 */
export function useReport(path, range, { enabled = true } = {}) {
  const { state, lastSyncedAt } = useDashboard();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const companyId = scopedCompanyId(state);
  const from = range && range.from;
  const to = range && range.to;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoading(true);
    apiRequest(path, { query: { companyId, from: from || undefined, to: to || undefined } })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, companyId, from, to, enabled, lastSyncedAt]);

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
