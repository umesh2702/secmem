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

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
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
    const targetSpaceId = spId || currentSpace?.id;
    if (!targetSpaceId) return;

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

      if (memList && memList.length > 0) {
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
  }, [currentSpace?.id, supabase]);

  // Initial load
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let currentProfile: Profile | null = null;
      if (user) {
        currentProfile = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Umesh',
          avatar_url: user.user_metadata?.avatar_url || null,
          created_at: user.created_at,
        };
        setCurrentUser(currentProfile);

        const { data: memberRows } = await supabase
          .from('space_members')
          .select('space_id, spaces(*)')
          .eq('user_id', user.id)
          .limit(1);

        if (memberRows && memberRows.length > 0) {
          const sp = memberRows[0].spaces as unknown as Space;
          setCurrentSpace(sp);

          const { data: spaceMem } = await supabase
            .from('space_members')
            .select('profiles(*)')
            .eq('space_id', sp.id);

          if (spaceMem) {
            setMembers(spaceMem.map((sm: any) => sm.profiles).filter(Boolean));
          }

          const { data: tagList } = await supabase.from('tags').select('*').eq('space_id', sp.id);
          if (tagList) setTags(tagList);

          const { data: memList } = await supabase
            .from('memories')
            .select(`
              *,
              author:profiles(id, full_name, avatar_url, email),
              attachments(*),
              memory_tags(tags(*))
            `)
            .eq('space_id', sp.id)
            .order('created_at', { ascending: false });

          if (memList && memList.length > 0) {
            const formatted: Memory[] = memList.map((m: any) => ({
              ...m,
              tags: m.memory_tags ? m.memory_tags.map((mt: any) => mt.tags).filter(Boolean) : [],
            }));
            setMemories(formatted);
          } else {
            loadDemoMemories(sp.id, currentProfile);
          }
        } else {
          loadDemoMemories('demo-space-id', currentProfile);
        }
      } else {
        loadDemoMemories('demo-space-id', null);
      }
    } catch (err) {
      console.warn('Fallback due to connection error:', err);
      loadDemoMemories('demo-space-id', null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const loadDemoMemories = (spaceId: string, profile: Profile | null) => {
    const demoUser: Profile = profile || {
      id: 'demo-user-1',
      email: 'umesh@example.com',
      full_name: 'Umesh',
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

    const partnerUser: Profile = {
      id: 'demo-user-2',
      email: 'partner@example.com',
      full_name: 'Friend',
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

    setCurrentUser(demoUser);
    setMembers([demoUser, partnerUser]);
    setCurrentSpace({
      id: spaceId,
      name: "Umesh & Friend's Vault",
      invite_code: 'MEM-8X92',
      created_by: demoUser.id,
      created_at: new Date().toISOString(),
    });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);

    const demoMemories: Memory[] = [
      {
        id: 'demo-1',
        space_id: spaceId,
        created_by: demoUser.id,
        author: demoUser,
        title: 'ULink Restaurant NFC Concept',
        content:
          'We should launch ULink before December. What if restaurants had a small NFC display at checkout so customers could tap to leave feedback or get digital menus?',
        type: 'TEXT',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        tags: [
          { id: 't1', space_id: spaceId, name: 'ideas' },
          { id: 't2', space_id: spaceId, name: 'product' },
          { id: 't5', space_id: spaceId, name: 'ulink' },
        ],
      },
      {
        id: 'demo-2',
        space_id: spaceId,
        created_by: partnerUser.id,
        author: partnerUser,
        title: 'Interesting Event Stand Design',
        content: 'Found an interesting event stand design with integrated QR & NFC ripples for physical interaction.',
        type: 'LINK',
        metadata: {
          url: 'https://ulink.example.com/stand-design',
          domain: 'ulink.example.com',
        },
        created_at: new Date(now.getTime() - 3600000 * 2).toISOString(),
        updated_at: new Date(now.getTime() - 3600000 * 2).toISOString(),
        tags: [{ id: 't3', space_id: spaceId, name: 'design' }],
      },
      {
        id: 'demo-3',
        space_id: spaceId,
        created_by: demoUser.id,
        author: demoUser,
        title: 'Shared Memory App Roadmap',
        content:
          'We should build the shared memory application with Supabase RLS, Gemini server-side Q&A, and fast date timeline.',
        type: 'TEXT',
        created_at: yesterday.toISOString(),
        updated_at: yesterday.toISOString(),
        tags: [
          { id: 't1', space_id: spaceId, name: 'ideas' },
          { id: 't4', space_id: spaceId, name: 'ucreates' },
        ],
      },
    ];

    setMemories(demoMemories);
    setTags([
      { id: 't1', space_id: spaceId, name: 'ideas' },
      { id: 't2', space_id: spaceId, name: 'product' },
      { id: 't3', space_id: spaceId, name: 'design' },
      { id: 't4', space_id: spaceId, name: 'ucreates' },
      { id: 't5', space_id: spaceId, name: 'ulink' },
    ]);
  };

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
      if (!matchTitle && !matchContent && !matchTag && !matchUrl) return false;
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
    <div className="min-h-screen bg-[#0B0C0E] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header
        currentSpace={currentSpace}
        members={members}
        currentUser={currentUser}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        onLogout={handleLogout}
      />

      {/* Main Layout Area */}
      <div className="flex flex-1 max-w-7xl w-full mx-auto pb-16 lg:pb-0">
        {/* Navigation Sidebar */}
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

        {/* Main View Area */}
        <main className="flex-1 p-4 lg:p-6 space-y-6 max-w-4xl mx-auto w-full">
          {/* Active Search / Tag Banner */}
          {(searchQuery || selectedTag) && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#C6FF00]/10 border border-[#C6FF00]/30 text-xs text-[#C6FF00]">
              <span>
                {searchQuery ? `Global Search: "${searchQuery}"` : `Filtering by Tag: #${selectedTag}`}
              </span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag(null);
                }}
                className="text-slate-400 hover:text-white underline font-medium"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Primary View Router */}
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#C6FF00]" />
              <span>Connecting to memory vault...</span>
            </div>
          ) : activeNav === 'chat' || activeNav === 'history' ? (
            <ChatVaultView
              spaceId={currentSpace?.id || null}
              currentUser={currentUser}
              activeConversationId={activeConversationId}
              onConversationCreated={(convId) => setActiveConversationId(convId)}
              onSelectMemory={(m) => setSelectedMemory(m)}
              onMemoryCreated={() => refreshMemoriesSilently()}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
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
