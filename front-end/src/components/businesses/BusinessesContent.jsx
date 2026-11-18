import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from '../../lib/http.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import BusinessesList from './BusinessesList.jsx';
import BusinessDetails from './BusinessDetails.jsx';
import useBusinessActions from './useBusinessActions.js';

/**
 * Super user portal. Company records are read straight from GET /companies
 * (plan, subscription, renewal, version and all), staff from the users the
 * dashboard already loaded.
 */
export default function BusinessesContent() {
  const { hasActionAccess, users, lastSyncedAt } = useDashboard();
  const [companies, setCompanies] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const [detailsId, setDetailsId] = useState(null);
  const canManage = hasActionAccess('businesses');

  const reload = useCallback(async () => {
    try {
      const rows = await api('/companies');
      setCompanies(Array.isArray(rows) ? rows : []);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: errorText(err, 'Could not load businesses') });
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload, lastSyncedAt]);

  const actions = useBusinessActions({ companies, reload, showDetails: setDetailsId });

  if (state.error && !companies.length) {
    return (
      <section className="card">
        <div className="card-bd">
          <p>{state.error}</p>
          <button type="button" className="btn btn-outline" onClick={reload}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  const company = detailsId ? companies.find((c) => c.id === detailsId) : null;
  if (company) {
    return (
      <BusinessDetails
        company={company}
        staff={users.filter((u) => u.companyId === company.id)}
        canManage={canManage}
        actions={actions}
      />
    );
  }
  return (
    <BusinessesList
      companies={companies}
      users={users}
      loading={state.loading}
      canManage={canManage}
      actions={actions}
    />
  );
}
