import ChartCanvas, { getColors } from '../../../shared/components/common/ChartCanvas.jsx';
import { shortDay, currencySymbol, convertInrToActiveCurrency } from '../../orders/components/orderFormat.js';

export function ChartCard({ title, height = '260px', children }) {
  return (
    <div className="card">
      <div className="card-hd">
        <h3>{title}</h3>
      </div>
      <div className="card-bd" style={{ position: 'relative', height }}>
        {children}
      </div>
    </div>
  );
}

const axes = (extra = {}) => {
  const c = getColors();
  return {
    scales: {
      x: { grid: { display: false }, ticks: { color: c.text } },
      y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text } },
      ...extra,
    },
  };
};

/** Gross and net sales per day (bars) with the bill count (line, right axis). */
export function SalesByDayChart({ days }) {
  const data = () => {
    const c = getColors();
    const sym = currencySymbol();
    return {
      labels: days.map((d) => shortDay(d.day)),
      datasets: [
        { label: `Net sales (${sym})`, data: days.map((d) => Math.round(convertInrToActiveCurrency(d.net))), backgroundColor: c.green, yAxisID: 'y' },
        { label: `Refunds (${sym})`, data: days.map((d) => Math.round(convertInrToActiveCurrency(d.refunds))), backgroundColor: c.red, yAxisID: 'y' },
        { label: 'Bills', data: days.map((d) => d.orders), type: 'line', borderColor: c.blue, tension: 0.3, yAxisID: 'y1' },
      ],
    };
  };
  const options = () => {
    const c = getColors();
    return axes({ y1: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { color: c.text, precision: 0 } } });
  };
  return <ChartCanvas id="repDayChart" type="bar" data={data} options={options} />;
}

export function SalesByHourChart({ hours }) {
  const data = () => {
    const c = getColors();
    const byHour = new Map((hours || []).map((h) => [h.hour, h]));
    const labels = [];
    const values = [];
    for (let h = 7; h <= 22; h += 1) {
      labels.push(`${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`);
      values.push(byHour.has(h) ? byHour.get(h).orders : 0);
    }
    return { labels, datasets: [{ label: 'Bills', data: values, backgroundColor: c.purple }] };
  };
  const options = () => ({ ...axes(), plugins: { legend: { display: false } } });
  return <ChartCanvas id="repHourChart" type="bar" data={data} options={options} />;
}

export function MixChart({ id, counts, emptyLabel = 'No data' }) {
  const data = () => {
    const c = getColors();
    const labels = Object.keys(counts || {});
    return {
      labels: labels.length ? labels : [emptyLabel],
      datasets: [
        {
          data: labels.length ? labels.map((k) => counts[k]) : [1],
          backgroundColor: labels.length ? [c.green, c.blue, c.purple, c.amber, c.red, '#8e8e93'] : ['rgba(128,128,128,0.25)'],
          borderWidth: 0,
        },
      ],
    };
  };
  const options = () => ({ plugins: { legend: { position: 'right', labels: { color: getColors().text } } } });
  return <ChartCanvas id={id} type="doughnut" data={data} options={options} />;
}

export function CategoryChart({ rows }) {
  const data = () => {
    const c = getColors();
    const sym = currencySymbol();
    return {
      labels: rows.map((r) => r.category),
      datasets: [{ label: `Sales (${sym})`, data: rows.map((r) => Math.round(convertInrToActiveCurrency(r.sales))), backgroundColor: c.blue }],
    };
  };
  const options = () => ({ ...axes(), indexAxis: 'y', plugins: { legend: { display: false } } });
  return <ChartCanvas id="repCatChart" type="bar" data={data} options={options} />;
}
