import { useLayoutEffect, useRef } from 'react';
import { formatRupees } from '../../lib/cashier/posHelpers.js';

// Right-click / long-press size picker (ui.js showContextMenu()).
// `menu` = { open, x, y, product, measure }. When `measure` is set the menu was
// just opened at (x, y) and is flipped if it would overflow the viewport.
export default function ContextMenu({ menu, onPick, onReposition }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (!menu.open || !menu.measure || !ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    let { x, y } = menu;
    if (menu.x + bounds.width > window.innerWidth) x = menu.x - bounds.width;
    if (menu.y + bounds.height > window.innerHeight) y = menu.y - bounds.height;
    onReposition(x, y);
  }, [menu, onReposition]);

  const style = menu.x === null
    ? { display: 'none' }
    : { display: menu.open ? 'block' : 'none', left: `${menu.x}px`, top: `${menu.y}px` };

  return (
    <div className="context-menu" id="contextMenu" style={style} ref={ref}>
      {menu.product && menu.product.options.map((opt, index) => (
        <div
          key={`${opt.label}-${index}`}
          className="context-menu-item"
          onClick={(event) => {
            event.stopPropagation();
            onPick(menu.product, opt);
          }}
        >
          <span className="cmi-label">{opt.label}</span>
          <span className="cmi-price">{formatRupees(opt.price)}</span>
        </div>
      ))}
    </div>
  );
}
