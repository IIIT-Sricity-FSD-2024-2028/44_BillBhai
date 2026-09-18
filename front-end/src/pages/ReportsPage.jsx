// React port of reports.html + renderReports() / initReportCharts() in dashboard.js.
import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import FilterToolbar from '../components/common/FilterToolbar.jsx';
import ReportStats from '../components/reports/ReportStats.jsx';
import { ChartCard, PaymentMixChart, RevenueTrendChart, StatusMixChart } from '../components/reports/ReportCharts.jsx';
import { SummaryTable, SupplierTable } from '../components/reports/ReportTables.jsx';
import {
  buildReportView,
  SUMMARY_SORT_OPTIONS,
  SUPPLIER_SORT_OPTIONS,
  TIME_RANGE_OPTIONS,
} from '../components/reports/reportData.js';
import { useDashboard } from '../lib/dashboard/hooks.js';
import { ROLE_LABELS } from '../lib/dashboard/constants.js';

function ReportsContent() {
  const { orders, returns, inventory, roleKey, scopedBusinessName } = useDashboard();
  const [rangeKey, setRangeKey] = useState('30d');
  const [summarySort, setSummarySort] = useState('newest');
  const [supplierSort, setSupplierSort] = useState('value_high');

  // renderReportView(): derived during render from data + the three selects.
  const { stats, summaryRows, supplierRows, chartState } = buildReportView({
    orders, returns, inventory, rangeKey, summarySort, supplierSort,
  });

  // The original destroyed and re-created every chart on each select change.
  const chartKey = `${rangeKey}|${summarySort}|${supplierSort}`;

  return (
    <>
      <PageHeader
        title={`Reports${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={<button className="btn btn-outline" onClick={() => window.print()}>Print</button>}
      />
      <section className="card" style={{ marginBottom: '14px' }}>
        <FilterToolbar filters={[
          { id: 'reportsTimeRange', label: 'Time range', value: rangeKey, onChange: setRangeKey, options: TIME_RANGE_OPTIONS },
          { id: 'reportsSummarySort', label: 'Summary sort', value: summarySort, onChange: setSummarySort, options: SUMMARY_SORT_OPTIONS },
          { id: 'reportsSupplierSort', label: 'Supplier sort', value: supplierSort, onChange: setSupplierSort, options: SUPPLIER_SORT_OPTIONS },
        ]} />
      </section>
      <ReportStats stats={stats} roleLabel={ROLE_LABELS[roleKey] || 'Team Member'} />
      <section className="grid-2">
        <ChartCard title="Revenue Trend" height="260px"><RevenueTrendChart key={chartKey} chartState={chartState} /></ChartCard>
        <ChartCard title="Order Status Mix" height="260px"><StatusMixChart key={chartKey} chartState={chartState} /></ChartCard>
      </section>
      <section className="grid-2">
        <ChartCard title="Payment Method Mix" height="240px"><PaymentMixChart key={chartKey} chartState={chartState} /></ChartCard>
        <div className="card"><div className="card-hd"><h3>Supplier Stock Value</h3></div><div className="card-bd"><SupplierTable rows={supplierRows} /></div></div>
      </section>
      <section className="card"><div className="card-hd"><h3>Period Summary</h3></div><div className="card-bd"><SummaryTable rows={summaryRows} /></div></section>
    </>
  );
}

export default function ReportsPage() {
  return (
    <DashboardLayout page="reports">
      <ReportsContent />
    </DashboardLayout>
  );
}
