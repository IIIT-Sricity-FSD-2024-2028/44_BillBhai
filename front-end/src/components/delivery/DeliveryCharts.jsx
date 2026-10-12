// The "Status Breakdown" + "Partner Load" cards and initDeliveryCharts().
import ChartCanvas, { getColors } from '../common/ChartCanvas.jsx';
import { getDeliveryChartData } from './deliveryView.js';

const CHART_BODY_STYLE = { position: 'relative', height: '220px' };

export default function DeliveryCharts({ deliveries, partnerTitle }) {
  const statusData = () => {
    const c = getColors();
    const { statusCounts } = getDeliveryChartData(deliveries);
    return {
      labels: ['Delivered', 'In Transit', 'Pending', 'Failed'],
      datasets: [{
        data: [statusCounts.delivered, statusCounts.inTransit, statusCounts.pending, statusCounts.failed],
        backgroundColor: [c.green, c.blue, c.amber, c.red],
        borderWidth: 0,
      }],
    };
  };
  const statusOptions = () => ({ plugins: { legend: { position: 'right', labels: { color: getColors().text } } } });

  const partnerData = () => {
    const c = getColors();
    const { partnerLabels, partnerData: data } = getDeliveryChartData(deliveries);
    return { labels: partnerLabels, datasets: [{ label: 'Deliveries', data, backgroundColor: c.blue }] };
  };
  const partnerOptions = () => {
    const c = getColors();
    return {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: c.grid, display: false }, ticks: { color: c.text } },
        y: { grid: { color: c.grid }, ticks: { color: c.text, precision: 0 }, beginAtZero: true },
      },
    };
  };

  return (
    <section className="grid-2">
      <div className="card">
        <div className="card-hd"><h3>Status Breakdown</h3></div>
        <div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="delStatusChart" type="doughnut" data={statusData} options={statusOptions} /></div>
      </div>
      <div className="card">
        <div className="card-hd"><h3>{partnerTitle}</h3></div>
        <div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="delPartnerChart" type="bar" data={partnerData} options={partnerOptions} /></div>
      </div>
    </section>
  );
}
