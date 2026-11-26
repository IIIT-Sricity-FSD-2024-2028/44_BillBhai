import { useEffect, useRef } from 'react';
import useViewState from '../../../shared/hooks/useViewState.js';

export default function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useViewState(false);

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
  }, [setVisible, visible]);

  return [ref, visible ? 'reveal visible' : 'reveal'];
}
