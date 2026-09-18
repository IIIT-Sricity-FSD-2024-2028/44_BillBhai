import { useLayoutEffect } from 'react';

/**
 * Each original HTML page loaded its own stylesheets, Google Font weights and
 * <body> attributes. In a single-page app those would leak between routes, so
 * every page mounts exactly what its HTML file had and removes it on unmount.
 *
 *   usePageSetup({
 *     title: 'BillBhai - Dashboard',
 *     styles: [dashboardCss],               // CSS text imported with `?inline`
 *     fonts: FONTS.inter300to700,           // Google Fonts stylesheet href
 *     bodyClass: 'no-sidebar',              // optional
 *     bodyAttrs: { 'data-page': 'orders' }, // optional
 *   });
 *
 * Attributes/classes added later by other components (data-role,
 * data-app-ready, no-sidebar-layout) are also cleared on unmount so the next
 * page starts from a clean <body>, just like a fresh HTML page load.
 */
export default function usePageSetup({ title, styles = [], fonts, bodyClass = '', bodyAttrs = {} }) {
  const stylesKey = styles.join('\n/* -- */\n');
  const attrsKey = JSON.stringify(bodyAttrs);

  useLayoutEffect(() => {
    const body = document.body;
    const head = document.head;
    const added = [];

    if (fonts) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fonts;
      link.setAttribute('data-page-asset', '');
      head.appendChild(link);
      added.push(link);
    }

    styles.forEach((css) => {
      const style = document.createElement('style');
      style.setAttribute('data-page-asset', '');
      style.textContent = css;
      head.appendChild(style);
      added.push(style);
    });

    if (title) document.title = title;
    if (bodyClass) body.className = bodyClass;
    Object.entries(bodyAttrs).forEach(([name, value]) => body.setAttribute(name, value));

    return () => {
      added.forEach((node) => node.remove());
      body.removeAttribute('class');
      Array.from(body.attributes)
        .filter((attr) => attr.name.startsWith('data-'))
        .forEach((attr) => body.removeAttribute(attr.name));
      body.removeAttribute('style');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, stylesKey, fonts, bodyClass, attrsKey]);
}
