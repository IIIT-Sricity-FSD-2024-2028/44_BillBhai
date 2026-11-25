import ChartCanvas from '../../../shared/components/common/ChartCanvas.jsx';
import { buildCategoryPieData, buildStockLevelsData, LEGEND_RIGHT_OPTIONS } from './inventoryChartData.js';

const CHART_BODY_STYLE = { position: 'relative', height: '220px' };

export function DistributionCard({ inventory }) {
  return (
    <div className="card">
      <div className="card-hd">
        <h3>Products by category</h3>
      </div>
      <div className="card-bd" style={CHART_BODY_STYLE}>
        <ChartCanvas key={inventory.length} id="invCatChart" type="pie" data={() => buildCategoryPieData(inventory)} options={LEGEND_RIGHT_OPTIONS} />
      </div>
    </div>
  );
}

/** Closest to running out (stock against reorder level). */
export function StockCard({ inventory }) {
  const signature = inventory.map((i) => `${i.productId}:${i.stock}`).join('|');
  return (
    <div className="card">
      <div className="card-hd">
        <h3>Closest to running out</h3>
      </div>
      <div className="card-bd" style={CHART_BODY_STYLE}>
        <ChartCanvas key={signature} id="invStockChart" type="bar" data={() => buildStockLevelsData(inventory)} />
      </div>
    </div>
  );
}
