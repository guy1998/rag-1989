import { useRef, useEffect, useState } from 'react';
import { Send, ChevronDown, Database } from 'lucide-react';

export default function ChatInput({
  onSend,
  disabled,
  models = [],
  selectedModel,
  onModelChange,
  loading,
}) {
  const [text, setText] = useState('');
  const [open, setOpen]   = useState(false);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled || loading) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const selected = models.find((m) => m.name === selectedModel);

  return (
    <div className="border-t border-sakura-100 bg-white/80 backdrop-blur-sm px-4 py-3">
      {/* Data source selector */}
      <div className="flex items-center justify-center mb-2" ref={dropdownRef}>
        <div className="relative">
          <button
            onClick={() => setOpen((p) => !p)}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-sakura-200 rounded-full px-3 py-1
                       hover:bg-sakura-50 hover:text-sakura-500 transition-colors"
          >
            <Database size={11} className="text-sakura-400" />
            {selected ? (
              <span className="font-medium text-sakura-500">{selected.name}</span>
            ) : (
              <span className="italic text-gray-400">Select a data source…</span>
            )}
            <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56
                            bg-white border border-sakura-100 rounded-2xl shadow-sakura-lg py-1 z-20 animate-fade-in">
              {models.length === 0 && (
                <p className="text-xs text-gray-400 px-4 py-2 text-center">
                  No data sources yet
                </p>
              )}
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onModelChange(m.name); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors
                    ${m.name === selectedModel
                      ? 'text-sakura-500 bg-sakura-50'
                      : 'text-gray-600 hover:bg-sakura-50 hover:text-sakura-500'
                    }`}
                >
                  <Database size={11} />
                  {m.name}
                  <span className="ml-auto text-gray-400 font-normal">{m.pdfCount} PDF{m.pdfCount !== 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2 bg-white rounded-2xl border border-sakura-200 px-4 py-2.5 shadow-sakura
                      focus-within:border-sakura-300 focus-within:shadow-sakura-lg transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={selectedModel ? 'Ask anything…' : 'Select a data source to start…'}
          disabled={disabled || !selectedModel}
          rows={1}
          className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400
                     bg-transparent leading-relaxed py-0.5 max-h-44 overflow-y-auto
                     disabled:cursor-not-allowed"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || disabled || loading || !selectedModel}
          className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-sakura-300 to-sakura-400
                     text-white flex items-center justify-center
                     hover:from-sakura-400 hover:to-sakura-500
                     disabled:opacity-40 disabled:cursor-not-allowed
                     active:scale-90 transition-all shadow-sakura"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={14} />
          )}
        </button>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-2">
        Shift+Enter for newline · Enter to send
      </p>
    </div>
  );
}
