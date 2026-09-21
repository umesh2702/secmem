'use client';

import { useState } from 'react';
import { Hash, Folder, FileText, Image as ImageIcon, Link as LinkIcon, Paperclip } from 'lucide-react';
import { Memory, Tag } from '@/types/database';
import MemoryCard from './MemoryCard';

interface ThemesViewProps {
  memories: Memory[];
  tags: Tag[];
  onSelectMemory: (m: Memory) => void;
}

export default function ThemesView({ memories, tags, onSelectMemory }: ThemesViewProps) {
  // Built-in theme categories merged with dynamic tags
  const defaultThemes = ['ulink', 'ucreates', 'ideas', 'business', 'design', 'projects', 'events'];
  const allThemeNames = Array.from(
    new Set([...defaultThemes, ...tags.map((t) => t.name.toLowerCase())])
  );

  const [selectedTheme, setSelectedTheme] = useState<string>(allThemeNames[0] || 'ideas');

  // Filter memories matching selected theme
  const themeMemories = memories.filter((m) => {
    const matchTag = m.tags?.some((t) => t.name.toLowerCase() === selectedTheme);
    const matchContent = m.content.toLowerCase().includes(selectedTheme);
    const matchTitle = m.title?.toLowerCase().includes(selectedTheme);
    return matchTag || matchContent || matchTitle;
  });

  return (
    <div className="space-y-6">
      {/* Theme Header & Selector Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Folder className="w-4 h-4 text-[#C6FF00]" />
            <span>Vault Themes & Topics</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">{allThemeNames.length} Themes</span>
        </div>

        {/* Horizontal Theme Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {allThemeNames.map((themeName) => {
            const count = memories.filter((m) => {
              const matchTag = m.tags?.some((t) => t.name.toLowerCase() === themeName);
              const matchContent = m.content.toLowerCase().includes(themeName);
              return matchTag || matchContent;
            }).length;

            const isSelected = selectedTheme === themeName;
            return (
              <button
                key={themeName}
                onClick={() => setSelectedTheme(themeName)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#C6FF00] text-black shadow-md shadow-[#C6FF00]/10'
                    : 'bg-[#14161B] border border-[#222630] text-slate-300 hover:text-white'
                }`}
              >
                <Hash className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-slate-500'}`} />
                <span className="capitalize">{themeName}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isSelected ? 'bg-black/20 text-black' : 'bg-[#0B0C0E] text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme Details View */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#14161B] border border-[#222630]">
          <div>
            <h3 className="text-base font-bold text-white capitalize flex items-center gap-2">
              <span>Theme: #{selectedTheme}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Showing {themeMemories.length} memories grouped under topic #{selectedTheme}
            </p>
          </div>
        </div>

        {themeMemories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themeMemories.map((mem) => (
              <MemoryCard key={mem.id} memory={mem} onSelect={onSelectMemory} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center bg-[#14161B] border border-[#222630] rounded-2xl p-8">
            <p className="text-xs text-slate-400">No memories filed under #{selectedTheme} yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
