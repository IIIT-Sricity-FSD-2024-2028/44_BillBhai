import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/** dashboard.js getColors() */
export function getColors() {
  return {
    text: '#f0f0f0',
    grid: 'rgba(255,255,255,0.05)',
    red: '#dc3545', amber: '#e8a838', blue: '#64b5f6', green: '#51cf66', purple: '#bf5af2',
  };
}

/** dashboard.js createChart() option merge: shallow `{ ...defaults, ...options }`. */
export function buildChartOptions(type, options) {
  const c = getColors();
  const defaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: c.text } } },
    scales: type !== 'pie' && type !== 'doughnut' ? {
      x: { grid: { color: c.grid, display: false }, ticks: { color: c.text } },
      y: { grid: { color: c.grid }, ticks: { color: c.text } },
    } : {},
  };
  return { ...defaults, ...options };
}

/**
 * <canvas id={id}> + Chart.js instance (port of createChart(id, type, data, options)).
 *
 * The chart is built once when the canvas mounts (the original created charts
 * in a setTimeout after renderPage) and destroyed on unmount. `data` /
 * `options` may be objects or functions returning them (evaluated at build
 * time). Changing props does NOT rebuild the chart, exactly like the original;
 * give the component a new `key` (or call renderPage()) to rebuild it.
 */
export default function ChartCanvas({ id, type, data, options }) {
  const canvasRef = useRef(null);
  const latest = useRef({ type, data, options });
  latest.current = { type, data, options };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const cfg = latest.current;
    const chartData = typeof cfg.data === 'function' ? cfg.data() : cfg.data;
    const chartOptions = typeof cfg.options === 'function' ? cfg.options() : cfg.options;
    const chart = new Chart(canvas, { type: cfg.type, data: chartData, options: buildChartOptions(cfg.type, chartOptions) });
    return () => chart.destroy();
  }, []);

  return <canvas id={id} ref={canvasRef} />;
}
