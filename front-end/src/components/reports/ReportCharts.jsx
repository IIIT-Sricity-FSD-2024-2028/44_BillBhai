// initReportCharts(): the three Chart.js charts, built from the current report view.
import ChartCanvas, { getColors } from '../common/ChartCanvas.jsx';

export function ChartCard({ title, height, children }) {
  return (
    <div className="card"><div className="card-hd"><h3>{title}</h3></div><div className="card-bd" style={{ position: 'relative', height }}>{children}</div></div>
  );
}

export function RevenueTrendChart({ chartState }) {
  const data = () => {
    const c = getColors();
    const trend = chartState.revenueTrend || { labels: ['No data'], values: [0] };
    return {
      labels: trend.labels,
      datasets: [{
        label: 'Revenue',
        data: trend.values,
        borderColor: c.blue,
        backgroundColor: 'rgba(100,181,246,0.1)',
        tension: 0.35,
        fill: true,
      }],
    };
  };
  return <ChartCanvas id="repRevChart" type="line" data={data} />;
}

export function StatusMixChart({ chartState }) {
  const data = () => {
    const c = getColors();
    const s = chartState.statusCounts || { delivered: 0, processing: 0, pending: 0, cancelled: 0 };
    return {
      labels: ['Delivered', 'Processing', 'Pending', 'Cancelled'],
      datasets: [{
        data: [s.delivered, s.processing, s.pending, s.cancelled],
        backgroundColor: [c.green, c.blue, c.amber, c.red],
      }],
    };
  };
  return <ChartCanvas id="repStatusChart" type="doughnut" data={data} />;
}

export function PaymentMixChart({ chartState }) {
  const data = () => {
    const c = getColors();
    const labels = Array.isArray(chartState.paymentLabels) && chartState.paymentLabels.length ? chartState.paymentLabels : ['No Data'];
    const values = Array.isArray(chartState.paymentValues) && chartState.paymentValues.length ? chartState.paymentValues : [0];
    return {
      labels,
      datasets: [{ label: 'Orders', data: values, backgroundColor: c.purple }],
    };
  };
  const options = () => {
    const c = getColors();
    return {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: c.grid, display: false }, ticks: { color: c.text } },
        y: { grid: { color: c.grid }, ticks: { color: c.text, precision: 0 }, beginAtZero: true },
      },
    };
  };
  return <ChartCanvas id="repPaymentChart" type="bar" data={data} options={options} />;
}
