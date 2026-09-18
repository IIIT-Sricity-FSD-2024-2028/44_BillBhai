// Same-page `#section` links scroll smoothly with an 80px navbar offset.
// `href="#"` has no target, so (as in landing.js) the browser default runs.
export function smoothScrollToHash(event) {
  const href = event.currentTarget.getAttribute('href');
  if (!href || href === '#') return;
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  event.preventDefault();
  const offset = 80;
  const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

// <a href="#..."> with the smooth-scroll behaviour attached.
export function HashLink({ onClick, ...props }) {
  return (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a
      {...props}
      onClick={(event) => {
        if (onClick) onClick(event);
        smoothScrollToHash(event);
      }}
    />
  );
}
