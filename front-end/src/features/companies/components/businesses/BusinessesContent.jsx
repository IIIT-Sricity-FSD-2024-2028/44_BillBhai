import { useCallback, useEffect } from 'react';
import useViewState from '../../../../shared/hooks/useViewState.js';
import { useDispatch, useSelector } from 'react-redux';
import { useDashboard } from '../../../../shared/lib/dashboard/hooks.js';
import {
  fetchCompaniesThunk,
  selectCompaniesState,
} from '../../companiesSlice.js';
import BusinessesList from './BusinessesList.jsx';
import BusinessDetails from './BusinessDetails.jsx';
import useBusinessActions from './useBusinessActions.js';

/**
 * Super user portal. Company records are fetched via `fetchCompaniesThunk`
 * and read exclusively from Redux (`companiesSlice`).
 */
export default function BusinessesContent() {
  const dispatch = useDispatch();
  const { hasActionAccess, users, lastSyncedAt } = useDashboard();
  const { items: companies, status, error } = useSelector(selectCompaniesState);
  const [detailsId, setDetailsId] = useViewState(null);
  const canManage = hasActionAccess('businesses');
  const loading = status === 'idle' || status === 'loading';

  const reload = useCallback(() => dispatch(fetchCompaniesThunk()), [dispatch]);

  useEffect(() => {
    reload();
  }, [reload, lastSyncedAt]);

  const actions = useBusinessActions({ companies, reload, showDetails: setDetailsId });

  if (error && !companies.length) {
    return (
      <section className="card">
        <div className="card-bd">
          <p>{error}</p>
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
      loading={loading}
      canManage={canManage}
      actions={actions}
    />
  );
}
