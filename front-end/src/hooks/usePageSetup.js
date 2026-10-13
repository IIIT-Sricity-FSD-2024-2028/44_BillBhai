import { useLayoutEffect } from 'react';

export default function usePageSetup({
  title,
  styles = [],
  fonts,
  bodyClass = '',
  bodyAttrs = {},
}) {
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
