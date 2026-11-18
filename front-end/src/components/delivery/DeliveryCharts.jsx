import ChartCanvas, { getColors } from '../common/ChartCanvas.jsx';
import { DELIVERY_STATUS_FLOW } from '../../lib/dashboard/helpers.js';
import { partnerLoad } from './deliveryView.js';

const CHART_BODY_STYLE = { position: 'relative', height: '220px' };

function statusData(deliveries) {
  const c = getColors();
  const colours = {
    Pending: c.amber,
    Assigned: '#14b8a6',
    Dispatched: c.blue,
    'Out for Delivery': c.purple,
    Delivered: c.green,
    'Failed Attempt': c.red,
    'Returned to Store': '#9ca3af',
    Cancelled: '#6b7280',
  };
  const present = DELIVERY_STATUS_FLOW.filter((s) => deliveries.some((d) => d.status === s));
  return {
    labels: present.length ? present : ['No deliveries'],
    datasets: [
      {
        data: present.length ? present.map((s) => deliveries.filter((d) => d.status === s).length) : [0],
        backgroundColor: present.map((s) => colours[s]),
        borderWidth: 0,
      },
    ],
  };
}

function loadData(deliveries) {
  const c = getColors();
  const load = [...partnerLoad(deliveries).entries()].sort((a, b) => b[1] - a[1]);
  return {
    labels: load.length ? load.map(([name]) => name) : ['Nobody on duty'],
    datasets: [{ label: 'Open deliveries', data: load.length ? load.map(([, n]) => n) : [0], backgroundColor: c.blue }],
  };
}

/** Status breakdown and how many open parcels each partner carries. */
export default function DeliveryCharts({ deliveries }) {
  const signature = deliveries.map((d) => `${d.id}:${d.status}:${d.partner}`).join('|');
  return (
    <section className="grid-2">
      <div className="card">
        <div className="card-hd">
          <h3>Deliveries by status</h3>
        </div>
        <div className="card-bd" style={CHART_BODY_STYLE}>
          <ChartCanvas
            key={signature}
            id="deliveryStatusChart"
            type="doughnut"
            data={() => statusData(deliveries)}
            options={() => ({ plugins: { legend: { position: 'right', labels: { color: getColors().text } } } })}
          />
        </div>
      </div>
      <div className="card">
        <div className="card-hd">
          <h3>Partner load (open parcels)</h3>
        </div>
        <div className="card-bd" style={CHART_BODY_STYLE}>
          <ChartCanvas
            key={`load-${signature}`}
            id="deliveryLoadChart"
            type="bar"
            data={() => loadData(deliveries)}
            options={() => {
              const c = getColors();
              return {
                scales: {
                  x: { grid: { display: false }, ticks: { color: c.text } },
                  y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, precision: 0 } },
                },
              };
            }}
          />
        </div>
      </div>
    </section>
  );
}
