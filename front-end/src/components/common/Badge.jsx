import { badgeClass } from '../../lib/dashboard/helpers.js';

/**
 * Port of dashboard.js badge(txt, type) / statusBadge(s).
 *
 *   <Badge status="Delivered" />                 -> <span class="badge b-delivered">Delivered</span>
 *   <Badge status={o.payment} type={o.payment.toLowerCase()} />   (badge(txt, type))
 *   <Badge status="In Transit" type="processing" />                (colour override)
 *   <Badge label="Critical" type="cancelled" />                    (text + colour)
 *
 * The colour class is decided in one place (badgeClass): `b-` + the type
 * (or the status text) lower-cased with every non-alphanumeric removed.
 */
export default function Badge({ status, type, label, children, className, style, ...rest }) {
  const text = children !== undefined ? children : (label !== undefined ? label : status);
  const colourSource = type !== undefined ? type : (status !== undefined ? status : label);
  const cls = badgeClass(typeof text === 'string' ? text : '', colourSource);
  return (
    <span className={className ? `${cls} ${className}` : cls} style={style} {...rest}>{text}</span>
  );
}
