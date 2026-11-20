import { useEffect, useRef } from 'react';

// Adds `is-visible` to every `.reveal` inside the returned ref once it scrolls into view.
export default function useReveal(threshold = 0.12) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const targets = root.querySelectorAll('.reveal');
    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [threshold]);

  return ref;
}
