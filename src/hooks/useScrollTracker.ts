import { useEffect, useRef } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { computeScrollDepthPercent } from '../utils/typingMath';

export function useScrollTracker() {
  const { updateScroll, addConsoleEntry } = useProfileStore();
  const lastScrollTop = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const directionChanges = useRef(0);
  const scrollEvents = useRef(0);
  const lastDirection = useRef<'up' | 'down' | null>(null);
  const maxDepth = useRef(0);
  const hasLoggedRef = useRef(false);
  const lastUpdateTime = useRef(0);
  const pendingUpdate = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
      const dt = (now - lastScrollTime.current) / 1000;

      scrollEvents.current++;

      if (dt > 0) {
        const distance = Math.abs(currentScrollTop - lastScrollTop.current);
        const speed = distance / dt;

        // Detect direction change (only on actual movement)
        if (currentScrollTop !== lastScrollTop.current) {
          const currentDirection = currentScrollTop > lastScrollTop.current ? 'down' : 'up';
          if (lastDirection.current && lastDirection.current !== currentDirection) {
            directionChanges.current++;
          }
          lastDirection.current = currentDirection;
        }

        // Track max scroll depth — measured as the portion of the document the user has seen.
        const depthPercent = computeScrollDepthPercent(
          currentScrollTop,
          window.innerHeight,
          document.documentElement.scrollHeight,
        );
        if (depthPercent > maxDepth.current) {
          maxDepth.current = depthPercent;
        }

        lastScrollTop.current = currentScrollTop;
        lastScrollTime.current = now;

        // Throttle store updates to every 250ms
        if (now - lastUpdateTime.current >= 250) {
          lastUpdateTime.current = now;
          updateScroll({
            speed: Math.round(speed),
            maxDepth: Math.round(maxDepth.current),
            directionChanges: directionChanges.current,
            scrollEvents: scrollEvents.current,
          });
        } else if (!pendingUpdate.current) {
          // Schedule a trailing update
          pendingUpdate.current = setTimeout(() => {
            lastUpdateTime.current = Date.now();
            updateScroll({
              speed: Math.round(speed),
              maxDepth: Math.round(maxDepth.current),
              directionChanges: directionChanges.current,
              scrollEvents: scrollEvents.current,
            });
            pendingUpdate.current = null;
          }, 250);
        }

        if (!hasLoggedRef.current) {
          addConsoleEntry('SCAN', 'Scroll behavior tracking active');
          hasLoggedRef.current = true;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (pendingUpdate.current) {
        clearTimeout(pendingUpdate.current);
      }
    };
  }, [updateScroll, addConsoleEntry]);
}
