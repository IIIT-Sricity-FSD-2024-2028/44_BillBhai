// One delivery queue row (same markup on the Delivery page and the Delivery Ops dashboard).
import Badge from '../common/Badge.jsx';
import { deliveryBadgeProps, normalizeDeliveryStatus } from '../../lib/dashboard/helpers.js';

const SMALL_BTN = { padding: '4px 8px', fontSize: '0.75rem' };
const ASSIGN_BTN = { ...SMALL_BTN, marginRight: '4px' };
const PHONE_LINK = { color: 'var(--accent)', textDecoration: 'none' };

/**
 * `d` is a getDeliveryView() row. `canManage` = hasActionAccess('delivery'):
 * when false the [data-action=delivery] buttons are not rendered.
 */
export default function DeliveryRow({ d, canManage, onAssign, onEdit }) {
  const updated = d.updatedAt === '-' ? '—' : d.updatedAt;
  const eta = d.etaMin === null ? '—' : `${Math.max(0, Math.round(d.etaMin))} min`;
  const partnerPhone = d.partnerPhoneHref
    ? <a href={d.partnerPhoneHref} style={PHONE_LINK}>{d.partnerPhone}</a>
    : d.partnerPhone;
  const badge = deliveryBadgeProps(d.status);

  return (
    <tr>
      <td className="cell-main">{d.id}</td>
      <td>{d.oid}</td>
      <td>{d.customer}</td>
      <td>{d.address}</td>
      <td>{d.partner}<div className="text-sm text-muted">{`${d.partnerAgency} • `}{partnerPhone}</div></td>
      <td>{eta}</td>
      <td><Badge label={badge.text} type={badge.type} /></td>
      <td>{updated}</td>
      <td>
        {d.partnerPhoneHref
          ? <a className="btn btn-outline" style={SMALL_BTN} href={d.partnerPhoneHref}>Call Partner</a>
          : <span className="text-muted text-sm">No contact</span>}
      </td>
      <td>
        {canManage && (
          <button className="btn btn-outline" data-action="delivery" style={ASSIGN_BTN} onClick={() => onAssign(d.id)}>Assign Delivery</button>
        )}
        {canManage && normalizeDeliveryStatus(d.status) !== 'Delivered' && (
          <button className="btn btn-outline" data-action="delivery" style={SMALL_BTN} onClick={() => onEdit(d.id)}>Edit</button>
        )}
      </td>
    </tr>
  );
}
