// Pure helpers shared by the Delivery page and the Delivery Ops dashboard.
import { normalizeDeliveryStatus } from '../../lib/dashboard/helpers.js';

/** The `counts` reduce from renderDelivery() / renderDeliveryOpsDashboard(). */
export function getDeliveryCounts(view) {
  return view.reduce((acc, d) => {
    acc.total += 1;
    if (d.status === 'Delivered') acc.delivered += 1;
    else if (d.status === 'In Transit') acc.inTransit += 1;
    else if (d.status === 'Failed') acc.failed += 1;
    else acc.pending += 1;
    if (d.partner === 'Unassigned') acc.unassigned += 1;
    return acc;
  }, { total: 0, delivered: 0, inTransit: 0, pending: 0, failed: 0, unassigned: 0 });
}

/** Data half of initDeliveryCharts() (reads the raw deliveries, not the view). */
export function getDeliveryChartData(deliveries) {
  const statusCounts = { delivered: 0, inTransit: 0, pending: 0, failed: 0 };
  const partnerCounts = new Map();

  deliveries.forEach((d) => {
    const status = normalizeDeliveryStatus(d.status);
    if (status === 'Delivered') statusCounts.delivered += 1;
    else if (status === 'In Transit') statusCounts.inTransit += 1;
    else if (status === 'Failed') statusCounts.failed += 1;
    else statusCounts.pending += 1;

    const partner = String(d.partner || '').trim();
    const isActive = status === 'Pending' || status === 'In Transit';
    if (partner && isActive) partnerCounts.set(partner, (partnerCounts.get(partner) || 0) + 1);
  });

  const partnerList = Array.from(partnerCounts.entries())
    .filter(([name]) => name.toLowerCase() !== 'unassigned')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return {
    statusCounts,
    partnerLabels: partnerList.length ? partnerList.map(([name]) => name) : ['No partners'],
    partnerData: partnerList.length ? partnerList.map(([, count]) => count) : [0],
  };
}
