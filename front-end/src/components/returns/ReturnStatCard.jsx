import StatCard from '../common/StatCard.jsx';
import { SUB_TEXT_STYLE } from './returnIcons.jsx';

export default function ReturnStatCard({ sub, ...card }) {
  return (
    <StatCard {...card}>
      {sub !== undefined && (
        <div className="text-sm text-muted" style={SUB_TEXT_STYLE}>
          {sub}
        </div>
      )}
    </StatCard>
  );
}
