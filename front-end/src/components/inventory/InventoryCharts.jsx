// Chart cards of renderInventory() + initInventoryCharts().
import ChartCanvas from '../common/ChartCanvas.jsx';
import { buildCategoryPieData, buildStockLevelsData, LEGEND_RIGHT_OPTIONS } from './inventoryChartData.js';

const CHART_BODY_STYLE = { position: 'relative', height: '220px' };

export function DistributionCard({ inventory }) {
  return (
    <div className="card"><div className="card-hd"><h3>Category Distribution</h3></div><div className="card-bd" style={CHART_BODY_STYLE}>
      <ChartCanvas id="invCatChart" type="pie" data={() => buildCategoryPieData(inventory)} options={LEGEND_RIGHT_OPTIONS} />
    </div></div>
  );
}

export function StockCard({ inventory }) {
  return (
    <div className="card"><div className="card-hd"><h3>Stock Levels</h3></div><div className="card-bd" style={CHART_BODY_STYLE}>
      <ChartCanvas id="invStockChart" type="bar" data={() => buildStockLevelsData(inventory)} />
    </div></div>
  );
}
