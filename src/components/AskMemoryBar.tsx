'use client';

import { useState } from 'react';
import { Sparkles, Send, BookOpen, AlertCircle, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Memory } from '@/types/database';

interface AskMemoryBarProps {
  spaceId: string | null;
  onSelectMemory: (m: Memory) => void;
}

export default function AskMemoryBar({ spaceId, onSelectMemory }: AskMemoryBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Memory[]>([]);
  const [isAiAvailable, setIsAiAvailable] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const samplePrompts = [
    'What business ideas did we discuss?',
    'When did we first talk about ULink?',
    'Find everything related to restaurants.',
  ];

  const handleAsk = async (textToAsk?: string) => {
    const q = textToAsk || query;
    if (!q.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setAnswer(null);
    setSources([]);

    try {
      const res = await fetch('/api/ask-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim(), spaceId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');

      setAnswer(data.answer);
      setSources(data.sources || []);
      setIsAiAvailable(data.isAiAvailable ?? true);
    } catch (err: unknown) {
      console.error('Ask memory error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error consulting memory vault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#14161B] border border-[#222630] rounded-2xl p-5 shadow-xl space-y-4">
      {/* Search Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#C6FF00]/10 border border-[#C6FF00]/20 flex items-center justify-center text-[#C6FF00]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-white tracking-tight">Ask Our Memory</h2>
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
          <ShieldCheck className="w-3 h-3 text-[#C6FF00]" />
          <span>Strict Source Retrieval</span>
        </div>
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="relative"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="💭 Ask anything stored in your shared vault..."
          className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl pl-4 pr-12 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C6FF00]/50 transition-colors shadow-inner"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#C6FF00] hover:bg-[#b8ee00] text-black transition-colors disabled:opacity-30 cursor-pointer"
        >
          {loading ? (
            <span className="inline-block animate-spin text-xs">⌛</span>
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </form>

      {/* Sample Prompt Chips */}
      {!answer && !loading && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-slate-500 font-semibold mr-1">Suggestions:</span>
          {samplePrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setQuery(prompt);
                handleAsk(prompt);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#0B0C0E] border border-[#222630] hover:border-[#C6FF00]/40 text-[10px] text-slate-400 hover:text-white transition-colors text-left"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Answer Output Card */}
      {answer && (
        <div className="mt-4 p-4 rounded-xl bg-[#0B0C0E] border border-[#222630] space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#222630] pb-2">
            <span className="text-xs font-semibold text-[#C6FF00] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Memory Synthesis</span>
            </span>
            {!isAiAvailable && (
              <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20 font-mono">
                Fallback Database Mode
              </span>
            )}
          </div>

          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{answer}</p>

          {/* Interactive Source References */}
          {sources.length > 0 && (
            <div className="pt-3 border-t border-[#222630] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-[#C6FF00]" />
                  <span>Original Source Memories ({sources.length})</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Click to view raw memory</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sources.map((src) => {
                  const author = src.author?.full_name || 'Member';
                  const date = new Date(src.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  return (
                    <button
                      key={src.id}
                      onClick={() => onSelectMemory(src)}
                      className="p-2.5 rounded-xl bg-[#14161B] border border-[#222630] hover:border-[#C6FF00]/40 text-left flex items-start justify-between gap-2 group transition-colors"
                    >
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                          <span className="font-semibold text-slate-300">{author}</span>
                          <span>•</span>
                          <span className="font-mono">{date}</span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium truncate">
                          {src.title || src.content}
                        </p>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#C6FF00] shrink-0 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
