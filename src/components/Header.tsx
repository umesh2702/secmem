'use client';

import { useState } from 'react';
import { Sparkles, Users, Copy, Check, LogOut, Search, Plus } from 'lucide-react';
import { Space, Profile } from '@/types/database';

interface HeaderProps {
  currentSpace: Space | null;
  members: Profile[];
  currentUser: Profile | null;
  onOpenAddModal: () => void;
  onSearchChange: (q: string) => void;
  searchQuery: string;
  onLogout: () => void;
}

export default function Header({
  currentSpace,
  members,
  currentUser,
  onOpenAddModal,
  onSearchChange,
  searchQuery,
  onLogout,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyInviteCode = () => {
    if (!currentSpace?.invite_code) return;
    navigator.clipboard.writeText(currentSpace.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0B0C0E]/90 backdrop-blur-md border-b border-[#222630] px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Space Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C6FF00]/10 border border-[#C6FF00]/20 flex items-center justify-center text-[#C6FF00] font-black tracking-tighter">
            OM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none">
                {currentSpace?.name || 'Our Shared Memory'}
              </h1>
              {currentSpace?.invite_code && (
                <button
                  onClick={copyInviteCode}
                  title="Copy Invite Code for Partner"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#14161B] border border-[#222630] hover:border-[#C6FF00]/40 text-[10px] text-slate-300 font-mono transition-colors"
                >
                  <span>{currentSpace.invite_code}</span>
                  {copied ? <Check className="w-3 h-3 text-[#C6FF00]" /> : <Copy className="w-3 h-3 text-slate-500" />}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Private Memory Vault</p>
          </div>
        </div>

        {/* Global Search Input (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search memories, tags, filenames..."
            className="w-full bg-[#14161B] border border-[#222630] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C6FF00]/50 transition-colors"
          />
        </div>

        {/* Right Section: Member Avatars, + Add Memory CTA, Profile Logout */}
        <div className="flex items-center gap-3">
          {/* Partner Avatars */}
          <div className="hidden sm:flex items-center -space-x-2 mr-1">
            {members.length > 0 ? (
              members.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  title={m.full_name || m.email}
                  className="w-7 h-7 rounded-full bg-[#1c202a] border-2 border-[#0B0C0E] flex items-center justify-center text-[10px] font-bold text-[#C6FF00] overflow-hidden"
                >
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (m.full_name || m.email).slice(0, 2).toUpperCase()
                  )}
                </div>
              ))
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#14161B] border border-[#222630] flex items-center justify-center text-[10px] text-slate-400">
                <Users className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Quick Add CTA */}
          <button
            onClick={onOpenAddModal}
            className="bg-[#C6FF00] hover:bg-[#b8ee00] text-black font-semibold rounded-xl px-3.5 py-2 text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-[#C6FF00]/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Memory</span>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Log Out"
            className="p-2 rounded-xl bg-[#14161B] hover:bg-rose-500/10 border border-[#222630] hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
