import StatCard from '../common/StatCard.jsx';

const META_STYLE = { marginTop: '6px' };

/** Reports stat card: the shared <StatCard> plus the `.text-sm.text-muted` meta line renderReports() put under the value. */
export default function ReportStatCard({ meta, metaId, ...card }) {
  return (
    <StatCard {...card}>
      <div className="text-sm text-muted" id={metaId} style={META_STYLE}>{meta}</div>
    </StatCard>
  );
}
