import StatCard from '../common/StatCard.jsx';

const META_STYLE = { marginTop: '6px' };

export default function ReportStatCard({ meta, metaId, ...card }) {
  return (
    <StatCard {...card}>
      <div className="text-sm text-muted" id={metaId} style={META_STYLE}>
        {meta}
      </div>
    </StatCard>
  );
}
