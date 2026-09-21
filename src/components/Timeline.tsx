'use client';

import { useState } from 'react';
import { Sparkles, Calendar, Filter, Plus } from 'lucide-react';
import { Memory, Profile } from '@/types/database';
import MemoryCard from './MemoryCard';

interface TimelineProps {
  memories: Memory[];
  currentUser: Profile | null;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onSelectMemory: (m: Memory) => void;
  onSelectTag?: (tagName: string) => void;
  onOpenAddModal: () => void;
}

export default function Timeline({
  memories,
  currentUser,
  activeFilter,
  onFilterChange,
  onSelectMemory,
  onSelectTag,
  onOpenAddModal,
}: TimelineProps) {
  // Group memories by Date string (e.g., "TODAY", "YESTERDAY", "Sep 20, 2026")
  const groupMemoriesByDate = (mems: Memory[]) => {
    const groups: { [key: string]: Memory[] } = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    mems.forEach((m) => {
      const d = new Date(m.created_at);
      let dateKey = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      if (d.toDateString() === today) {
        dateKey = 'TODAY';
      } else if (d.toDateString() === yesterday) {
        dateKey = 'YESTERDAY';
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(m);
    });

    return groups;
  };

  const grouped = groupMemoriesByDate(memories);
  const filterOptions = [
    { id: 'ALL', label: 'All' },
    { id: 'TEXT', label: 'Notes' },
    { id: 'IMAGE', label: 'Images' },
    { id: 'LINK', label: 'Links' },
    { id: 'FILE', label: 'Files' },
    { id: 'MINE', label: 'My Memories' },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Chips Bar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 custom-scrollbar">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 mr-1" />
          {filterOptions.map((opt) => {
            const isActive = activeFilter === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onFilterChange(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#C6FF00] text-black shadow-md shadow-[#C6FF00]/10'
                    : 'bg-[#14161B] border border-[#222630] text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Memory Streams Grouped by Date */}
      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([dateLabel, dateMemories]) => (
          <div key={dateLabel} className="space-y-4">
            {/* Date Group Header */}
            <div className="flex items-center gap-3 sticky top-[61px] z-20 bg-[#0B0C0E]/90 backdrop-blur-sm py-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14161B] border border-[#222630] text-[10px] font-extrabold text-[#C6FF00] uppercase tracking-wider">
                <Calendar className="w-3 h-3 text-[#C6FF00]" />
                <span>{dateLabel}</span>
              </div>
              <div className="flex-1 h-px bg-[#222630]" />
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dateMemories.map((mem) => (
                <MemoryCard
                  key={mem.id}
                  memory={mem}
                  onSelect={onSelectMemory}
                  onSelectTag={onSelectTag}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        /* Empty State */
        <div className="py-16 text-center bg-[#14161B] border border-[#222630] rounded-2xl p-8 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-[#C6FF00]/10 border border-[#C6FF00]/20 flex items-center justify-center text-[#C6FF00] mx-auto mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Nothing captured here yet</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Put thoughts, photos, links, or documents into your shared memory vault.
          </p>
          <button
            onClick={onOpenAddModal}
            className="bg-[#C6FF00] hover:bg-[#b8ee00] text-black font-semibold rounded-xl px-4 py-2.5 text-xs transition-colors inline-flex items-center gap-1.5 shadow-lg shadow-[#C6FF00]/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Capture First Memory</span>
          </button>
        </div>
      )}
    </div>
  );
}
