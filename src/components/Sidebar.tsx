'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Clock, Folder, FileText, Image as ImageIcon, Link as LinkIcon, Paperclip, Tag as TagIcon, Hash } from 'lucide-react';
import { Tag, Conversation } from '@/types/database';

interface SidebarProps {
  spaceId: string | null;
  activeNav: string;
  onNavChange: (nav: string) => void;
  activeConversationId: string | null;
  onSelectConversation: (convId: string) => void;
  tags: Tag[];
  selectedTag: string | null;
  onSelectTag: (tagName: string | null) => void;
}

export default function Sidebar({
  spaceId,
  activeNav,
  onNavChange,
  activeConversationId,
  onSelectConversation,
  tags,
  selectedTag,
  onSelectTag,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Fetch real conversations from Supabase
  const loadConversations = useCallback(async () => {
    if (!spaceId) return;
    try {
      const res = await fetch(`/api/conversations?spaceId=${spaceId}`);
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.warn('Failed to load conversations from Supabase:', err);
    }
  }, [spaceId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const vaultNav = [
    { id: 'chat', label: 'Chat Vault', icon: Sparkles, badge: 'AI' },
    { id: 'history', label: 'Chat History', icon: Clock },
  ];

  const exploreNav = [
    { id: 'all', label: 'All Memories', icon: Folder },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'links', label: 'Links', icon: LinkIcon },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'files', label: 'Documents & Files', icon: Paperclip },
    { id: 'themes', label: 'Themes & Topics', icon: Folder },
  ];

  // Group conversations by date
  const groupConversationsByDate = (convs: Conversation[]) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const groups: { today: Conversation[]; yesterday: Conversation[]; earlier: Conversation[] } = {
      today: [],
      yesterday: [],
      earlier: [],
    };

    convs.forEach((c) => {
      const d = new Date(c.updated_at || c.created_at).toDateString();
      if (d === today) {
        groups.today.push(c);
      } else if (d === yesterday) {
        groups.yesterday.push(c);
      } else {
        groups.earlier.push(c);
      }
    });

    return groups;
  };

  const grouped = groupConversationsByDate(conversations);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#090B10] border-r border-[#1E2536] p-4 gap-6 shrink-0 h-full overflow-y-auto custom-scrollbar">
        {/* VAULT MAIN NAV */}
        <div className="space-y-1.5">
          {vaultNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id && !selectedTag;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavChange(item.id);
                  onSelectTag(null);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#121620] text-white border border-[#C6FF00] shadow-md shadow-[#C6FF00]/5'
                    : 'text-slate-400 hover:text-white hover:bg-[#121620]/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#C6FF00]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-[#1A2608] border border-[#C6FF00] text-[9px] font-extrabold text-[#C6FF00]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* EXPLORE SECTION */}
        <div>
          <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">
            Explore
          </h3>
          <nav className="space-y-1">
            {exploreNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id && !selectedTag;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavChange(item.id);
                    onSelectTag(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#121620] text-[#C6FF00] border border-[#1E2536]'
                      : 'text-slate-400 hover:text-white hover:bg-[#121620]/40 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#C6FF00]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* CHAT HISTORY (if activeNav === 'history') */}
        {activeNav === 'history' && (
          <div className="space-y-3">
            <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Chat History
            </h3>

            {grouped.today.length > 0 && (
              <div className="space-y-1">
                <span className="px-4 text-[10px] font-bold text-[#C6FF00]">Today</span>
                {grouped.today.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectConversation(c.id);
                      onNavChange('chat');
                    }}
                    className={`w-full text-left px-4 py-1.5 rounded-lg text-xs truncate transition-colors ${
                      activeConversationId === c.id
                        ? 'bg-[#121620] text-[#C6FF00] font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#121620]'
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            {grouped.yesterday.length > 0 && (
              <div className="space-y-1">
                <span className="px-4 text-[10px] font-bold text-[#C6FF00]">Yesterday</span>
                {grouped.yesterday.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectConversation(c.id);
                      onNavChange('chat');
                    }}
                    className={`w-full text-left px-4 py-1.5 rounded-lg text-xs truncate transition-colors ${
                      activeConversationId === c.id
                        ? 'bg-[#121620] text-[#C6FF00] font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#121620]'
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            {grouped.earlier.length > 0 && (
              <div className="space-y-1">
                <span className="px-4 text-[10px] font-bold text-[#C6FF00]">Earlier</span>
                {grouped.earlier.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectConversation(c.id);
                      onNavChange('chat');
                    }}
                    className={`w-full text-left px-4 py-1.5 rounded-lg text-xs truncate transition-colors ${
                      activeConversationId === c.id
                        ? 'bg-[#121620] text-[#C6FF00] font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#121620]'
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            {conversations.length === 0 && (
              <p className="px-4 text-xs text-slate-500 italic">No chat sessions saved yet</p>
            )}
          </div>
        )}

        {/* TAGS SECTION */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 mb-2.5">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Tags
            </h3>
            {selectedTag && (
              <button onClick={() => onSelectTag(null)} className="text-[10px] text-[#C6FF00] hover:underline">
                Clear
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            {tags.length > 0 ? (
              tags.map((t) => {
                const isSelected = selectedTag === t.name;
                return (
                  <button
                    key={t.id || t.name}
                    onClick={() => {
                      onSelectTag(isSelected ? null : t.name);
                      onNavChange('all');
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1A2608] border border-[#C6FF00] text-[#C6FF00] font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#121620]/40 border border-transparent'
                    }`}
                  >
                    <TagIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })
            ) : (
              <button
                onClick={() => {
                  onSelectTag('ulink');
                  onNavChange('all');
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs transition-colors cursor-pointer ${
                  selectedTag === 'ulink'
                    ? 'bg-[#1A2608] border border-[#C6FF00] text-[#C6FF00] font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-[#121620]/40 border border-transparent'
                }`}
              >
                <TagIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">ulink</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090B10]/95 backdrop-blur-lg border-t border-[#1E2536] px-2 py-2 flex items-center justify-around">
        {[
          { id: 'chat', label: 'Chat', icon: Sparkles },
          { id: 'themes', label: 'Themes', icon: Folder },
          { id: 'all', label: 'Timeline', icon: FileText },
          { id: 'history', label: 'History', icon: Clock },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id && !selectedTag;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavChange(item.id);
                onSelectTag(null);
              }}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#C6FF00]' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

