import { useState } from 'react';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import BusinessesList from './BusinessesList.jsx';
import BusinessDetails from './BusinessDetails.jsx';
import useBusinessActions from './useBusinessActions.js';

/**
 * Content of superuser.html / businesses.html: the businesses list
 * (renderBusinesses) or one business (renderBusinessDetails). The view lives in
 * component state; renderPage() re-mounts this component, which resets it to
 * the list exactly like the original renderPage('superuser').
 */
export default function BusinessesContent() {
  const { businesses, hasActionAccess } = useDashboard();
  const [detailsId, setDetailsId] = useState(null);
  const actions = useBusinessActions({ showDetails: setDetailsId });
  const canManage = hasActionAccess('businesses');

  // renderBusinessDetails() fell back to renderBusinesses() for an unknown id.
  const business = detailsId ? businesses.find((b) => b.id === detailsId) : null;
  if (business) return <BusinessDetails business={business} canManage={canManage} actions={actions} />;
  return <BusinessesList businesses={businesses} canManage={canManage} actions={actions} />;
}
