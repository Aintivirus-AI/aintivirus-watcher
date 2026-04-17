import { useEffect, useRef } from 'react';
import { useProfileStore } from '../store/useProfileStore';

// selectionchange fires continuously while the user drags a selection —
// we only want to count distinct selections, so we debounce.
const SELECTION_DEBOUNCE_MS = 300;

export function useCopyPasteTracker() {
  const { updateCopyPaste, addConsoleEntry } = useProfileStore();
  const hasLoggedRef = useRef(false);
  // Ref-based counters — incrementing locally then pushing to store makes each
  // increment atomic within this hook, even if events fire in rapid succession.
  const copiesRef = useRef(0);
  const pastesRef = useRef(0);
  const rightClicksRef = useRef(0);
  const textSelectionsRef = useRef(0);
  const screenshotsRef = useRef(0);

  useEffect(() => {
    // Seed from current store state so we don't reset counters on hot-reload
    const seed = useProfileStore.getState().behavioral.copyPaste;
    copiesRef.current = seed.copies;
    pastesRef.current = seed.pastes;
    rightClicksRef.current = seed.rightClicks;
    textSelectionsRef.current = seed.textSelections;
    screenshotsRef.current = seed.screenshotAttempts;

    const handleCopy = () => {
      copiesRef.current++;
      updateCopyPaste({ copies: copiesRef.current });
      addConsoleEntry('DATA', 'Copy event detected');
    };

    const handlePaste = () => {
      pastesRef.current++;
      updateCopyPaste({ pastes: pastesRef.current });
      addConsoleEntry('DATA', 'Paste event detected');
    };

    const handleContextMenu = () => {
      rightClicksRef.current++;
      updateCopyPaste({ rightClicks: rightClicksRef.current });
    };

    let selectionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let wasSelecting = false;

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const hasSelection = (selection?.toString() || '').length > 0;

      if (hasSelection) {
        wasSelecting = true;
        if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);
        selectionDebounceTimer = setTimeout(() => {
          // Commit one selection event after the user stops extending it
          textSelectionsRef.current++;
          updateCopyPaste({ textSelections: textSelectionsRef.current });
          wasSelecting = false;

          if (!hasLoggedRef.current) {
            addConsoleEntry('SCAN', 'Text selection tracking active');
            hasLoggedRef.current = true;
          }
        }, SELECTION_DEBOUNCE_MS);
      } else if (wasSelecting && selectionDebounceTimer) {
        // Selection was cleared before debounce fired — discard
        clearTimeout(selectionDebounceTimer);
        selectionDebounceTimer = null;
        wasSelecting = false;
      }
    };

    // Screenshot detection (PrintScreen key)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        screenshotsRef.current++;
        updateCopyPaste({ screenshotAttempts: screenshotsRef.current });
        addConsoleEntry('ALERT', 'Screenshot attempt detected');
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleKeyDown);
      if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);
    };
  }, [updateCopyPaste, addConsoleEntry]);
}
