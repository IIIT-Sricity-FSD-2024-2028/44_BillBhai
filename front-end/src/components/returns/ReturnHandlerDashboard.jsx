// React port of renderReturnHandlerDashboard() (dashboard.js ~3517) + initReturnCharts().
// Rendered by DashboardPage for the returnhandler role.
import { useNavigate } from 'react-router-dom';
import PageHeader from '../common/PageHeader.jsx';
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';
import ReturnCharts from './ReturnCharts.jsx';
import ReturnStatCard from './ReturnStatCard.jsx';
import { COMPACT_VALUE_STYLE, RETURN_ICONS } from './returnIcons.jsx';
import { getReturnProductCounts, summarizeReturns } from './returnStats.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { getReturnView } from '../../lib/dashboard/helpers.js';

const COLUMNS = ['Order', 'Product', 'Reason', 'Amount', 'Status', 'Updated'];

export default function ReturnHandlerDashboard() {
  const { returns, orders, scopedBusinessName } = useDashboard();
  const navigate = useNavigate();

  const view = getReturnView({ returns, orders });
  const counts = summarizeReturns(view);
  const topProduct = getReturnProductCounts(view)[0] || null;
  const topProductName = topProduct ? topProduct[0] : '—';
  const topProductCount = topProduct ? topProduct[1] : 0;
  const topShare = counts.total && topProductCount ? Math.round((topProductCount / counts.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`Returns Dashboard${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={(
          <>
            <button className="btn btn-primary" onClick={() => navigate('/returns')}>Open Returns</button>
            <button className="btn btn-outline" onClick={() => window.print()}>Print</button>
          </>
        )}
      />

      <section className="stats-grid">
        <ReturnStatCard icon={RETURN_ICONS.returns} color="red" label="Total Returns" value={counts.total} />
        <ReturnStatCard icon={RETURN_ICONS.clock} color="amber" label="Pending" value={counts.pending} sub={`Rejected ${counts.rejected}`} />
        <ReturnStatCard
          icon={RETURN_ICONS.money} color="green" label="Refunded" value={counts.refunded}
          sub={`Value ₹${Math.round(counts.valueRefunded).toLocaleString()}`}
        />
        <ReturnStatCard
          icon={RETURN_ICONS.bars} color="purple" label="Most Returned" value={topProductName} valueStyle={COMPACT_VALUE_STYLE}
          sub={`${topProductCount} returns • ${topShare}% share`}
        />
      </section>

      <ReturnCharts view={view} />

      <section className="card">
        <div className="card-hd"><h3>Returned Orders</h3></div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={view.slice(0, 10)}
            emptyMessage="No returns found."
            getRowKey={(r, i) => `${r.id}-${i}`}
            renderRow={(r, i) => (
              <tr key={`${r.id}-${i}`}>
                <td className="cell-main">{r.oid}</td>
                <td>{r.product}</td>
                <td>{r.reason}</td>
                <td>₹{Number(r.amount || 0).toLocaleString()}</td>
                <td><Badge status={r.status} /></td>
                <td>{r.updatedAt}</td>
              </tr>
            )}
          />
        </div>
      </section>
    </>
  );
}
