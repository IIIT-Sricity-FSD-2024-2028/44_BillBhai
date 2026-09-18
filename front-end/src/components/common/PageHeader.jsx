/**
 * <div class="page-header"><h2>{title}</h2><div class="page-header-actions">{actions}</div></div>
 *
 * - `actions` undefined  -> no actions div (e.g. the plan-lock header).
 * - `actions` null/false -> empty actions div (what the original showed when
 *   every button in it was hidden for the current role).
 */
export default function PageHeader({ title, actions }) {
  return (
    <div className="page-header">
      <h2>{title}</h2>
      {actions !== undefined && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
