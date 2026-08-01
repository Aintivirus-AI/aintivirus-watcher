import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, ChevronDown } from 'lucide-react';
import type { ChatMessage } from '../../hooks/useVisitors';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isConnected: boolean;
  /** >0 while the server is throttling this connection's chat. */
  cooldownMs?: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatBox({ messages, onSend, isConnected, cooldownMs = 0 }: ChatBoxProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Count the throttle down locally; the server only tells us the total.
  useEffect(() => {
    if (cooldownMs <= 0) {
      setCooldownLeft(0);
      return;
    }
    setCooldownLeft(cooldownMs);
    const started = Date.now();
    const id = setInterval(() => {
      const left = cooldownMs - (Date.now() - started);
      setCooldownLeft(left > 0 ? left : 0);
      if (left <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [cooldownMs]);

  const throttled = cooldownLeft > 0;

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || throttled) return;
    onSend(input);
    setInput('');
  };

  return (
    <>
      {/* Toggle button - badge style, sits in the badges column */}
      {!open && (
        <motion.button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 bg-cyber-bg/60 backdrop-blur-xl pl-3 pr-4 md:pl-4 md:pr-5 py-2 md:py-2.5 rounded-full border border-cyber-cyan/20 text-cyber-cyan/70 hover:text-cyber-cyan hover:border-cyber-cyan/40 hover:bg-cyber-cyan/5 transition-all cursor-pointer"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <MessageSquare size={13} className="md:w-[15px] md:h-[15px]" />
          <span className="text-[10px] md:text-[11px] font-display font-semibold uppercase tracking-[0.15em] md:tracking-[0.2em]">
            Live Chat
          </span>
          {messages.length > 0 && (
            <span className="bg-cyber-cyan/15 text-cyber-cyan text-[9px] font-mono px-2 py-0.5 rounded-full min-w-[22px] text-center">
              {messages.length}
            </span>
          )}
        </motion.button>
      )}

      {/* Expanded chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="w-[280px] md:w-[320px] bg-cyber-bg/95 backdrop-blur-xl border border-cyber-cyan/10 shadow-2xl shadow-black/50 flex flex-col rounded-lg">
              {/* Header */}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-cyber-cyan/[0.03] cursor-pointer hover:bg-cyber-cyan/[0.06] transition-colors w-full"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare size={13} className="text-cyber-cyan" />
                  <span className="text-[10px] font-display font-semibold uppercase tracking-widest text-cyber-cyan/70">
                    Live Chat
                  </span>
                  {messages.length > 0 && (
                    <span className="text-[9px] font-mono text-white/25">
                      {messages.length}
                    </span>
                  )}
                </div>
                <ChevronDown size={14} className="text-white/30" />
              </button>

              {/* Messages */}
              <div
                ref={listRef}
                className="max-h-[220px] min-h-[100px] overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10"
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-5 gap-1.5">
                    <MessageSquare size={18} className="text-white/8" />
                    <p className="text-white/15 text-[10px] font-mono">
                      No messages yet
                    </p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={`${msg.timestamp}-${i}`} className="flex flex-col gap-0.5">
                    <p className="text-white/75 text-[12px] leading-[1.6] break-words">
                      {msg.text}
                    </p>
                    <span className="text-white/15 text-[9px] font-mono">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="border-t border-white/5 flex items-center gap-2 px-4 py-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    !isConnected
                      ? 'Disconnected'
                      : throttled
                        ? `Slow down — ${Math.ceil(cooldownLeft / 1000)}s`
                        : 'Say something...'
                  }
                  disabled={!isConnected || throttled}
                  maxLength={500}
                  className="flex-1 bg-transparent text-white/80 text-[12px] placeholder:text-white/20 outline-none disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={!isConnected || !input.trim() || throttled}
                  className="text-cyber-cyan/50 hover:text-cyber-cyan transition-colors disabled:opacity-20 disabled:cursor-not-allowed p-1"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
