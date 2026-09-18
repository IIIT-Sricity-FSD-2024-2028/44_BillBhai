// "Recent Activity" timeline. `items` come from getRecentProfileActivity()
// ({ time, before, strong, after }); an empty list shows the original fallback row.
export default function RecentActivityCard({ items }) {
  return (
    <div className="card">
      <div className="card-hd"><h3>Recent Activity</h3></div>
      <div className="card-bd">
        <div className="timeline">
          {items.length ? items.map((item, index) => (
            <div className="timeline-item" key={index}>
              <div className="timeline-marker" />
              <div className="timeline-time">{item.time}</div>
              <div className="timeline-content">{item.before}<strong>{item.strong}</strong>{item.after}</div>
            </div>
          )) : (
            <div className="timeline-item">
              <div className="timeline-marker" />
              <div className="timeline-time">Just now</div>
              <div className="timeline-content">No recent activity available.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
