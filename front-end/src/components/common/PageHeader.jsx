export default function PageHeader({ title, actions }) {
  return (
    <div className="page-header">
      <h2>{title}</h2>
      {actions !== undefined && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
