import { useEffect, useRef, useState } from 'react';

interface UseScrollChromeVisibilityOptions {
  scrollContainerSelector?: string;
}

export function useScrollChromeVisibility({
  scrollContainerSelector,
}: UseScrollChromeVisibilityOptions = {}) {
  const [isVisible, setIsVisible] = useState(true);
  const previousScrollTop = useRef(0);

  useEffect(() => {
    let frameId = 0;

    const updateVisibility = (scrollTop: number) => {
      if (Math.abs(scrollTop - previousScrollTop.current) < 8) return;

      setIsVisible(scrollTop < 24 || scrollTop < previousScrollTop.current);
      previousScrollTop.current = scrollTop;
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      const scrollContainer = scrollContainerSelector && target instanceof Element
        ? target.closest(scrollContainerSelector)
        : null;

      if (scrollContainerSelector && !scrollContainer) return;

      const scrollTop = scrollContainer instanceof HTMLElement
        ? scrollContainer.scrollTop
        : window.scrollY;

      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => updateVisibility(scrollTop));
    };

    document.addEventListener('scroll', handleScroll, true);
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [scrollContainerSelector]);

  return isVisible;
}
