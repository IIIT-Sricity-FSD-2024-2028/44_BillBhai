// Port of the three-card `.grid-3` chart section + initReturnCharts() (dashboard.js).
import ChartCanvas, { getColors } from '../common/ChartCanvas.jsx';
import { getReturnProductCounts, getReturnReasonCounts, summarizeReturns } from './returnStats.js';

const CHART_BODY_STYLE = { position: 'relative', height: '220px' };

function horizontalBarOptions() {
  const c = getColors();
  return {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: c.grid }, ticks: { color: c.text, precision: 0 }, beginAtZero: true },
      y: { grid: { color: c.grid, display: false }, ticks: { color: c.text } },
    },
  };
}

export default function ReturnCharts({ view }) {
  const productData = () => {
    const c = getColors();
    const top = getReturnProductCounts(view).slice(0, 6);
    return {
      labels: top.length ? top.map(([p]) => p) : ['No data'],
      datasets: [{ label: 'Returns', data: top.length ? top.map(([, n]) => n) : [0], backgroundColor: c.purple }],
    };
  };
  const reasonData = () => {
    const c = getColors();
    const sorted = getReturnReasonCounts(view);
    return {
      labels: sorted.length ? sorted.map(([r]) => r) : ['No data'],
      datasets: [{ label: 'Returns', data: sorted.length ? sorted.map(([, n]) => n) : [0], backgroundColor: c.red }],
    };
  };
  const statusData = () => {
    const c = getColors();
    const counts = summarizeReturns(view);
    return {
      labels: ['Pending', 'Refunded', 'Rejected'],
      datasets: [{
        data: [counts.pending, counts.refunded, counts.rejected],
        backgroundColor: [c.amber, c.green, c.red],
        borderWidth: 0,
      }],
    };
  };
  const statusOptions = () => ({ plugins: { legend: { position: 'right', labels: { color: getColors().text } } } });

  return (
    <section className="grid-3">
      <div className="card"><div className="card-hd"><h3>Top Returned Products</h3></div><div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="retProductChart" type="bar" data={productData} options={horizontalBarOptions} /></div></div>
      <div className="card"><div className="card-hd"><h3>Return Reasons</h3></div><div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="retReasonChart" type="bar" data={reasonData} options={horizontalBarOptions} /></div></div>
      <div className="card"><div className="card-hd"><h3>Status Breakdown</h3></div><div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="retStatusChart" type="doughnut" data={statusData} options={statusOptions} /></div></div>
    </section>
  );
}
