import { useEffect, useRef } from 'react';
import { useProfileStore } from '../store/useProfileStore';

export function useAttentionTracker() {
  const { updateAttention, addConsoleEntry } = useProfileStore();
  const tabSwitchesRef = useRef(0);
  const hiddenTimeRef = useRef(0);
  const focusTimeRef = useRef(0);
  const lastHiddenRef = useRef<number | null>(null);
  const lastFocusRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const firstInteractionRef = useRef<number | null>(null);
  const timesWentAFKRef = useRef(0);
  const hasLoggedRef = useRef(false);
  const hiddenIntervalsRef = useRef<number[]>([]); // Track how long each hidden period lasted

  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      const isVisible = document.visibilityState === 'visible';

      if (!isVisible) {
        // Tab became hidden
        lastHiddenRef.current = now;
        tabSwitchesRef.current++;
        timesWentAFKRef.current++;
        
        // Add focus time
        focusTimeRef.current += now - lastFocusRef.current;
        
        addConsoleEntry('SYSTEM', `Tab switch detected (total: ${tabSwitchesRef.current})`);
      } else {
        // Tab became visible again
        lastFocusRef.current = now;
        
        if (lastHiddenRef.current !== null) {
          const hiddenDuration = now - lastHiddenRef.current;
          hiddenTimeRef.current += hiddenDuration;
          hiddenIntervalsRef.current.push(hiddenDuration);
          
          // Analyze the hidden pattern
          const shortSwitches = hiddenIntervalsRef.current.filter(d => d < 5000).length;
          const longSwitches = hiddenIntervalsRef.current.filter(d => d >= 30000).length;
          
          if (hiddenDuration < 3000) {
            addConsoleEntry('INFO', `Quick tab switch (${Math.round(hiddenDuration / 1000)}s) - checking something else`);
          } else if (hiddenDuration > 60000) {
            addConsoleEntry('INFO', `Extended absence (${Math.round(hiddenDuration / 60000)} min) - you got distracted`);
          } else {
            addConsoleEntry('INFO', `User returned after ${Math.round(hiddenDuration / 1000)}s`);
          }
          
          // Log attention pattern insight
          if (shortSwitches >= 5 && hiddenIntervalsRef.current.length > 5) {
            addConsoleEntry('DATA', `Attention pattern: rapid context-switching (${shortSwitches} quick switches) - possibly distracted or multitasking`);
          } else if (longSwitches >= 2) {
            addConsoleEntry('DATA', `Attention pattern: extended focus elsewhere (${longSwitches} long absences)`);
          }
        }
      }

      updateAttention({
        tabSwitches: tabSwitchesRef.current,
        totalHiddenTime: hiddenTimeRef.current,
        lastVisibilityChange: now,
        isVisible,
        focusTime: focusTimeRef.current,
        timesWentAFK: timesWentAFKRef.current,
      });

      if (!hasLoggedRef.current) {
        addConsoleEntry('SCAN', 'Attention tracking initialized');
        hasLoggedRef.current = true;
      }
    };

    // Track first interaction
    const handleFirstInteraction = () => {
      if (firstInteractionRef.current === null) {
        firstInteractionRef.current = Date.now();
        updateAttention({ firstInteraction: firstInteractionRef.current });
        addConsoleEntry('DATA', `First interaction at ${firstInteractionRef.current - sessionStartRef.current}ms`);
      }
    };

    // Update focus time periodically
    const focusInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        focusTimeRef.current += 1000; // Add 1 second
        updateAttention({
          focusTime: focusTimeRef.current,
          sessionStart: sessionStartRef.current,
        });
      }
    }, 1000);

    // Initialize
    updateAttention({
      isVisible: document.visibilityState === 'visible',
      sessionStart: sessionStartRef.current,
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true });
    document.addEventListener('mousemove', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('mousemove', handleFirstInteraction);
      clearInterval(focusInterval);
    };
  }, [updateAttention, addConsoleEntry]);
}
