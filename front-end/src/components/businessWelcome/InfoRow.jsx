// One labelled credential tile in the `.grid` section.
export default function InfoRow({ label, id, value, valueStyle }) {
  return (
    <div className="row"><div className="label">{label}</div><div className="value" id={id} style={valueStyle}>{value}</div></div>
  );
}
