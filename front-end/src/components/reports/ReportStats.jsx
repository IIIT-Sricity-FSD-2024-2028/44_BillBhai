import ReportStatCard from './ReportStatCard.jsx';

const svgProps = { xmlns: 'http://www.w3.org/2000/svg', width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' };

const ICONS = {
  revenue: <svg {...svgProps}><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  orders: <svg {...svgProps}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></svg>,
  clock: <svg {...svgProps}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  returns: <svg {...svgProps}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  trend: <svg {...svgProps}><path d="M3 3v18h18" /><path d="M19 9l-5 5-4-4-3 3" /></svg>,
  suppliers: <svg {...svgProps}><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>,
};

/** The six `.stats-grid` cards of renderReports(), filled like its setText() calls. */
export default function ReportStats({ stats, roleLabel }) {
  return (
    <section className="stats-grid">
      <ReportStatCard icon={ICONS.revenue} color="green" label="Net Revenue" valueId="reportNetRevenue" value={stats.netRevenue} meta={`Role view: ${roleLabel}`} />
      <ReportStatCard icon={ICONS.orders} color="blue" label="Orders Processed" valueId="reportOrderCount" value={stats.orderCount} metaId="reportDeliveredMeta" meta={stats.deliveredMeta} />
      <ReportStatCard icon={ICONS.clock} color="amber" label="Avg Order Value" valueId="reportAvgOrderValue" value={stats.avgOrderValue} metaId="reportCompletionMeta" meta={stats.completionMeta} />
      <ReportStatCard icon={ICONS.returns} color="red" label="Return Value" valueId="reportReturnValue" value={stats.returnValue} metaId="reportPendingReturnsMeta" meta={stats.pendingReturnsMeta} />
      <ReportStatCard icon={ICONS.trend} color="purple" label="Revenue Window" valueId="reportRevenueWindow" value={stats.revenueWindow} metaId="reportScopeMeta" meta={stats.scopeMeta} />
      <ReportStatCard icon={ICONS.suppliers} color="blue" label="Top Suppliers" valueId="reportSupplierCount" value={stats.supplierCount} metaId="reportSupplierMeta" meta={stats.supplierMeta} />
    </section>
  );
}
