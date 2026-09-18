import { useEffect, useRef, useState } from 'react';

// landing.js added `reveal` to these blocks and `visible` once they scrolled
// into view (one-shot IntersectionObserver). Returns [ref, extra class names].
export default function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return [ref, visible ? 'reveal visible' : 'reveal'];
}
