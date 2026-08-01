import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { useProfileStore } from '../../store/useProfileStore';
import { downloadProfileExport } from '../../lib/profileExport';

/**
 * Hands the visitor the dossier the page just built about them.
 *
 * The site's whole argument is "look how much a page can infer without asking".
 * Letting people take the file with them makes that tangible instead of
 * something they have to take on trust — and it's the same data they'd get
 * from a subject-access request, minus the wait.
 */
export function ProfileExportButton() {
  const [done, setDone] = useState(false);

  // Selected individually so the button re-renders only when these change.
  const hardware = useProfileStore((s) => s.hardware);
  const network = useProfileStore((s) => s.network);
  const browser = useProfileStore((s) => s.browser);
  const behavioral = useProfileStore((s) => s.behavioral);
  const botDetection = useProfileStore((s) => s.botDetection);
  const fingerprints = useProfileStore((s) => s.fingerprints);
  const aiAnalysis = useProfileStore((s) => s.aiAnalysis);

  const handleExport = () => {
    downloadProfileExport({
      hardware: hardware as unknown as Record<string, unknown>,
      network: network as unknown as Record<string, unknown>,
      browser: browser as unknown as Record<string, unknown>,
      behavioral: behavioral as unknown as Record<string, unknown>,
      detection: botDetection as unknown as Record<string, unknown>,
      fingerprints: fingerprints as unknown as Record<string, unknown>,
      analysis: aiAnalysis as unknown as Record<string, unknown>,
    });
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={handleExport}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-cyber-cyan/15 bg-cyber-cyan/[0.03] px-4 py-3.5 text-left transition-all hover:border-cyber-cyan/35 hover:bg-cyber-cyan/[0.06]"
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan/80">
            {done ? 'Dossier downloaded' : 'Export your dossier'}
          </span>
          <span className="font-mono text-[10px] leading-relaxed text-white/30">
            {done
              ? 'Check your downloads folder.'
              : 'Everything on this page, as JSON. IP partially masked.'}
          </span>
        </span>
        <span className="shrink-0 text-cyber-cyan/50 transition-colors group-hover:text-cyber-cyan">
          {done ? <Check size={16} /> : <Download size={16} />}
        </span>
      </button>
    </div>
  );
}
