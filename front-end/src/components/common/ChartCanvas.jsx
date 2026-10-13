import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import useTheme from '../../hooks/useTheme.js';
import { getTheme } from '../../lib/theme.js';

export function getColors() {
  const light = getTheme() === 'light';
  return {
    text: light ? '#3b3f4c' : '#f0f0f0',
    grid: light ? 'rgba(22,24,33,0.08)' : 'rgba(255,255,255,0.05)',
    red: '#dc3545',
    amber: '#e8a838',
    blue: '#64b5f6',
    green: '#51cf66',
    purple: '#bf5af2',
  };
}

export function buildChartOptions(type, options) {
  const c = getColors();
  const defaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: c.text } } },
    scales:
      type !== 'pie' && type !== 'doughnut'
        ? {
            x: { grid: { color: c.grid, display: false }, ticks: { color: c.text } },
            y: { grid: { color: c.grid }, ticks: { color: c.text } },
          }
        : {},
  };
  return { ...defaults, ...options };
}

export default function ChartCanvas({ id, type, data, options }) {
  const { theme } = useTheme();
  const canvasRef = useRef(null);
  const latest = useRef({ type, data, options });
  latest.current = { type, data, options };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const cfg = latest.current;
    const chartData = typeof cfg.data === 'function' ? cfg.data() : cfg.data;
    const chartOptions = typeof cfg.options === 'function' ? cfg.options() : cfg.options;
    const chart = new Chart(canvas, {
      type: cfg.type,
      data: chartData,
      options: buildChartOptions(cfg.type, chartOptions),
    });
    return () => chart.destroy();
  }, [theme]);

  return <canvas id={id} ref={canvasRef} />;
}
