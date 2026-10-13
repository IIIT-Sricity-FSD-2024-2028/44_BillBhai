import { badgeClass } from '../../lib/dashboard/helpers.js';

export default function Badge({ status, type, label, children, className, style, ...rest }) {
  const text = children !== undefined ? children : label !== undefined ? label : status;
  const colourSource = type !== undefined ? type : status !== undefined ? status : label;
  const cls = badgeClass(typeof text === 'string' ? text : '', colourSource);
  return (
    <span className={className ? `${cls} ${className}` : cls} style={style} {...rest}>
      {text}
    </span>
  );
}
