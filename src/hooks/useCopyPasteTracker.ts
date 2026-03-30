import { useEffect, useRef } from 'react';
import { useProfileStore } from '../store/useProfileStore';

export function useCopyPasteTracker() {
  const { updateCopyPaste, addConsoleEntry } = useProfileStore();
  const hasLoggedRef = useRef(false);

  useEffect(() => {
    const handleCopy = () => {
      const state = useProfileStore.getState();
      updateCopyPaste({ copies: state.behavioral.copyPaste.copies + 1 });
      addConsoleEntry('DATA', 'Copy event detected');
    };

    const handlePaste = () => {
      const state = useProfileStore.getState();
      updateCopyPaste({ pastes: state.behavioral.copyPaste.pastes + 1 });
      addConsoleEntry('DATA', 'Paste event detected');
    };

    const handleContextMenu = () => {
      const state = useProfileStore.getState();
      updateCopyPaste({ rightClicks: state.behavioral.copyPaste.rightClicks + 1 });
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';
      
      if (selectedText.length > 0) {
        const state = useProfileStore.getState();
        updateCopyPaste({
          textSelections: state.behavioral.copyPaste.textSelections + 1,
        });

        if (!hasLoggedRef.current) {
          addConsoleEntry('SCAN', 'Text selection tracking active');
          hasLoggedRef.current = true;
        }
      }
    };

    // Screenshot detection (PrintScreen key)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        const state = useProfileStore.getState();
        updateCopyPaste({ screenshotAttempts: state.behavioral.copyPaste.screenshotAttempts + 1 });
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
    };
  }, [updateCopyPaste, addConsoleEntry]);
}
