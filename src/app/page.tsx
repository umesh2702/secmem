'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Memory, Space, Profile, Tag } from '@/types/database';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import ChatVaultView from '@/components/ChatVaultView';
import ThemesView from '@/components/ThemesView';
import Timeline from '@/components/Timeline';
import AddMemoryModal from '@/components/AddMemoryModal';
import MemoryDetailModal from '@/components/MemoryDetailModal';
import { RefreshCw } from 'lucide-react';

import { GLOBAL_SPACE_ID } from '@/lib/constants';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentSpace, setCurrentSpace] = useState<Space | null>({
    id: GLOBAL_SPACE_ID,
    name: 'Our Memory Vault',
    invite_code: 'GLOBAL-VAULT',
    created_by: null,
    created_at: new Date().toISOString(),
  });
  const [members, setMembers] = useState<Profile[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [activeNav, setActiveNav] = useState<string>('chat');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);

  // Silent refresh memory state without full UI re-mount
  const refreshMemoriesSilently = useCallback(async (spId?: string) => {
    const targetSpaceId = spId || GLOBAL_SPACE_ID;

    try {
      const { data: memList } = await supabase
        .from('memories')
        .select(`
          *,
          author:profiles(id, full_name, avatar_url, email),
          attachments(*),
          memory_tags(tags(*))
        `)
        .eq('space_id', targetSpaceId)
        .order('created_at', { ascending: false });

      if (memList) {
        const formatted: Memory[] = memList.map((m: any) => ({
          ...m,
          tags: m.memory_tags ? m.memory_tags.map((mt: any) => mt.tags).filter(Boolean) : [],
        }));
        setMemories(formatted);
      }

      const { data: tagList } = await supabase.from('tags').select('*').eq('space_id', targetSpaceId);
      if (tagList) setTags(tagList);
    } catch (err) {
      console.warn('Silent memory refresh error:', err);
    }
  }, [supabase]);

  // Initial load
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let activeProfile: Profile | null = null;

      if (user) {
        activeProfile = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member',
          avatar_url: user.user_metadata?.avatar_url || null,
          created_at: user.created_at,
        };
        setCurrentUser(activeProfile);

        await supabase.from('space_members').upsert({
          space_id: GLOBAL_SPACE_ID,
          user_id: user.id,
          role: 'member',
        });
      }

      const targetSpace: Space = {
        id: GLOBAL_SPACE_ID,
        name: 'Our Memory Vault',
        invite_code: 'GLOBAL-VAULT',
        created_by: null,
        created_at: new Date().toISOString(),
      };
      setCurrentSpace(targetSpace);

      const { data: spaceMem } = await supabase
        .from('space_members')
        .select('profiles(*)')
        .eq('space_id', GLOBAL_SPACE_ID);

      if (spaceMem) {
        setMembers(spaceMem.map((sm: any) => sm.profiles).filter(Boolean));
      }

      const { data: tagList } = await supabase.from('tags').select('*').eq('space_id', GLOBAL_SPACE_ID);
      if (tagList) setTags(tagList);

      const { data: memList } = await supabase
        .from('memories')
        .select(`
          *,
          author:profiles(id, full_name, avatar_url, email),
          attachments(*),
          memory_tags(tags(*))
        `)
        .eq('space_id', GLOBAL_SPACE_ID)
        .order('created_at', { ascending: false });

      if (memList) {
        const formatted: Memory[] = memList.map((m: any) => ({
          ...m,
          tags: m.memory_tags ? m.memory_tags.map((mt: any) => mt.tags).filter(Boolean) : [],
        }));
        setMemories(formatted);
      }
    } catch (err) {
      console.warn('Data initialization error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'om_demo_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  const filteredMemories = memories.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title?.toLowerCase().includes(q);
      const matchContent = m.content?.toLowerCase().includes(q);
      const matchTag = m.tags?.some((t) => t.name.toLowerCase().includes(q));
      const matchUrl = m.metadata?.url?.toLowerCase().includes(q);
      const matchFile = m.attachments?.some((a) => a.file_name.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchTag && !matchUrl && !matchFile) return false;
    }

    if (selectedTag) {
      if (!m.tags?.some((t) => t.name === selectedTag)) return false;
    }

    if (activeNav === 'images') return m.type === 'IMAGE';
    if (activeNav === 'links') return m.type === 'LINK';
    if (activeNav === 'files') return m.type === 'FILE';
    if (activeNav === 'notes') return m.type === 'TEXT';

    if (activeFilter === 'TEXT') return m.type === 'TEXT';
    if (activeFilter === 'IMAGE') return m.type === 'IMAGE';
    if (activeFilter === 'LINK') return m.type === 'LINK';
    if (activeFilter === 'FILE') return m.type === 'FILE';
    if (activeFilter === 'MINE') return m.created_by === currentUser?.id;

    return true;
  });

  return (
    <div className="h-screen w-screen bg-[#090B10] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Fixed Header */}
      <Header
        currentSpace={currentSpace}
        members={members}
        currentUser={currentUser}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        onLogout={handleLogout}
      />

      {/* Main App Shell Layout (Fixed Sidebar + Dynamic Scrollable Content) */}
      <div className="flex flex-1 min-h-0 w-full max-w-[1600px] mx-auto overflow-hidden">
        {/* Fixed Navigation Sidebar */}
        <Sidebar
          spaceId={currentSpace?.id || null}
          activeNav={activeNav}
          onNavChange={setActiveNav}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          tags={tags}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
        />

        {/* Scrollable Main View Container */}
        <main
          className={`flex-1 h-full min-h-0 w-full max-w-6xl mx-auto p-4 lg:p-6 flex flex-col ${
            activeNav === 'chat' || activeNav === 'history'
              ? 'overflow-hidden'
              : 'overflow-y-auto custom-scrollbar space-y-6'
          }`}
        >
          {/* Active Search / Tag Filter Banner */}
          {(searchQuery || selectedTag) && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1A2608]/40 border border-[#C6FF00]/40 text-xs text-[#C6FF00] shrink-0">
              <span>
                {searchQuery ? `Global Search: "${searchQuery}"` : `Filtering by Tag: #${selectedTag}`}
              </span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag(null);
                }}
                className="text-slate-400 hover:text-white underline font-semibold cursor-pointer"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* View Router */}
          {loading ? (
            <div className="py-24 text-center text-slate-400 text-xs flex items-center justify-center gap-2 flex-1">
              <RefreshCw className="w-4 h-4 animate-spin text-[#C6FF00]" />
              <span>Connecting to memory vault...</span>
            </div>
          ) : searchQuery || selectedTag ? (
            <Timeline
              memories={filteredMemories}
              currentUser={currentUser}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onSelectMemory={(m) => setSelectedMemory(m)}
              onSelectTag={(tagName) => setSelectedTag(tagName)}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          ) : activeNav === 'chat' || activeNav === 'history' ? (
            <div className="flex-1 min-h-0 h-full w-full">
              <ChatVaultView
                spaceId={currentSpace?.id || null}
                currentUser={currentUser}
                activeConversationId={activeConversationId}
                onConversationCreated={(convId) => setActiveConversationId(convId)}
                onSelectMemory={(m) => setSelectedMemory(m)}
                onMemoryCreated={() => refreshMemoriesSilently()}
                onOpenAddModal={() => setIsAddModalOpen(true)}
              />
            </div>
          ) : activeNav === 'themes' ? (
            <ThemesView
              memories={memories}
              tags={tags}
              onSelectMemory={(m) => setSelectedMemory(m)}
            />
          ) : (
            <Timeline
              memories={filteredMemories}
              currentUser={currentUser}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onSelectMemory={(m) => setSelectedMemory(m)}
              onSelectTag={(tagName) => setSelectedTag(tagName)}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <AddMemoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        spaceId={currentSpace?.id || null}
        userId={currentUser?.id || null}
        onMemoryCreated={() => refreshMemoriesSilently()}
      />

      <MemoryDetailModal
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
        onMemoryUpdated={() => refreshMemoriesSilently()}
        onMemoryDeleted={() => refreshMemoriesSilently()}
      />
    </div>
  );
}

