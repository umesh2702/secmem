'use client';

import { useState } from 'react';
import { Users, Search, Plus, LogOut } from 'lucide-react';
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
  const userInitials = currentUser?.full_name
    ? currentUser.full_name.slice(0, 1).toUpperCase()
    : currentUser?.email
    ? currentUser.email.slice(0, 1).toUpperCase()
    : 'U';

  return (
    <header className="shrink-0 w-full z-40 bg-[#090B10]/95 backdrop-blur-md border-b border-[#1E2536] px-4 lg:px-8 py-3">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#C6FF00] flex items-center justify-center text-black font-black tracking-tighter text-sm shadow-md shadow-[#C6FF00]/10">
            OM
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-tight leading-none">
              Our Memory
            </h1>
            <p className="text-[11px] text-slate-400 font-medium tracking-tight mt-0.5">
              Shared Memory Vault
            </p>
          </div>
        </div>

        {/* Center: Search Input Bar with Ctrl K */}
        <div className="hidden md:flex flex-1 max-w-xl mx-4 relative">
          <div className="w-full relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search memories, tags, filenames..."
              className="w-full bg-[#0F131C] border border-[#1E2536] rounded-full pl-10 pr-20 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#C6FF00]/60 transition-all shadow-inner"
            />
            <div className="absolute right-3 flex items-center gap-1 bg-[#1A202E] border border-[#252E42] text-slate-400 text-[10px] px-2 py-0.5 rounded-md font-mono pointer-events-none">
              <span>Ctrl</span>
              <span>K</span>
            </div>
          </div>
        </div>

        {/* Right: Vault Switcher, Add Memory CTA & User Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          {/* US Vault Switcher Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0F131C] border border-[#1E2536] text-xs text-slate-200 font-semibold cursor-pointer hover:border-[#C6FF00]/40 transition-colors">
            <span className="w-5 h-5 rounded-full bg-[#C6FF00]/20 text-[#C6FF00] font-bold text-[10px] flex items-center justify-center">
              US
            </span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* + Add Memory CTA Button */}
          <button
            onClick={onOpenAddModal}
            className="bg-[#C6FF00] hover:bg-[#b5f800] text-black font-bold rounded-full px-4 py-2 text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-[#C6FF00]/15 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Memory</span>
          </button>

          {/* User Profile Avatar */}
          <div
            onClick={onLogout}
            title={`${currentUser?.full_name || currentUser?.email || 'User'} (Click to Logout)`}
            className="w-8 h-8 rounded-full bg-[#182030] border border-[#2B354C] hover:border-rose-500/50 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition-colors shrink-0 shadow-sm"
          >
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span>{userInitials}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

