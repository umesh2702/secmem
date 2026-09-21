'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Clock, Folder, FileText, Image as ImageIcon, Link as LinkIcon, Paperclip, Hash, Plus } from 'lucide-react';
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
    { id: 'chat', label: 'Chat Vault', icon: MessageSquare, badge: 'AI' },
    { id: 'history', label: 'Chat History', icon: Clock },
  ];

  const exploreNav = [
    { id: 'themes', label: 'Themes & Topics', icon: Folder },
    { id: 'all', label: 'All Memories', icon: FileText },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'links', label: 'Links', icon: LinkIcon },
    { id: 'files', label: 'Documents & Files', icon: Paperclip },
  ];

  // Group conversations by Today, Yesterday, Earlier
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
      <aside className="hidden lg:flex flex-col w-64 border-r border-[#222630] bg-[#0B0C0E] p-4 gap-6 shrink-0 min-h-[calc(100vh-61px)]">
        {/* OUR VAULT */}
        <div>
          <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Our Vault
          </h3>
          <nav className="space-y-1">
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#14161B] text-[#C6FF00] border border-[#222630]'
                      : 'text-slate-400 hover:text-white hover:bg-[#14161B]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#C6FF00]' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[#C6FF00]/10 border border-[#C6FF00]/20 text-[9px] font-bold text-[#C6FF00]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* EXPLORE */}
        <div>
          <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#14161B] text-[#C6FF00] border border-[#222630]'
                      : 'text-slate-400 hover:text-white hover:bg-[#14161B]/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#C6FF00]' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* CHAT HISTORY (From Supabase) */}
        {activeNav === 'history' && (
          <div className="space-y-3">
            <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Supabase Chat History
            </h3>

            {grouped.today.length > 0 && (
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-semibold text-[#C6FF00]">Today</span>
                {grouped.today.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectConversation(c.id);
                      onNavChange('chat');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs truncate transition-colors ${
                      activeConversationId === c.id
                        ? 'bg-[#14161B] text-[#C6FF00] font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#14161B]'
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            {grouped.yesterday.length > 0 && (
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-semibold text-[#C6FF00]">Yesterday</span>
                {grouped.yesterday.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectConversation(c.id);
                      onNavChange('chat');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs truncate transition-colors ${
                      activeConversationId === c.id
                        ? 'bg-[#14161B] text-[#C6FF00] font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#14161B]'
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            {grouped.earlier.length > 0 && (
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-semibold text-[#C6FF00]">Earlier</span>
                {grouped.earlier.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectConversation(c.id);
                      onNavChange('chat');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs truncate transition-colors ${
                      activeConversationId === c.id
                        ? 'bg-[#14161B] text-[#C6FF00] font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#14161B]'
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            {conversations.length === 0 && (
              <p className="px-3 text-xs text-slate-600 italic">No chat sessions stored yet</p>
            )}
          </div>
        )}

        {/* TAGS */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Tags
            </h3>
            {selectedTag && (
              <button onClick={() => onSelectTag(null)} className="text-[10px] text-[#C6FF00]">
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
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#C6FF00]/10 border border-[#C6FF00]/30 text-[#C6FF00] font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#14161B]/50'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 text-xs text-slate-600 italic">No tags added yet</p>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0C0E]/95 backdrop-blur-lg border-t border-[#222630] px-2 py-2 flex items-center justify-around">
        {[
          { id: 'chat', label: 'Chat', icon: MessageSquare },
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
