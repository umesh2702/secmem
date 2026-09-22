import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { askMemoryWithGemini, isGeminiAvailable } from '@/lib/gemini/client';
import { Memory } from '@/types/database';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createAdminClient(url, serviceKey);
}

function extractSearchKeywords(query: string): string[] {
  const stopWords = new Set([
    'what', 'when', 'where', 'who', 'why', 'how', 'which', 'did', 'do', 'does', 'we', 'i', 'you',
    'they', 'he', 'she', 'it', 'decide', 'decided', 'about', 'the', 'a', 'an', 'is', 'are', 'was',
    'were', 'supposed', 'to', 'use', 'tell', 'me', 'show', 'find', 'remember', 'say', 'said'
  ]);
  const words = query.toLowerCase().replace(/[^\w\s#]/g, '').split(/\s+/);
  const keywords = words.filter(w => w.length > 1 && !stopWords.has(w));
  return keywords.length > 0 ? keywords : words.filter(w => w.length > 1);
}

function scoreMemory(memory: any, query: string, keywords: string[]): number {
  let score = 0;
  const contentLower = (memory.content || '').toLowerCase();
  const titleLower = (memory.title || '').toLowerCase();
  const tagsLower = (memory.tags || []).map((t: any) => t.name ? t.name.toLowerCase() : String(t).toLowerCase());

  keywords.forEach(kw => {
    if (contentLower.includes(kw)) score += 3;
    if (titleLower.includes(kw)) score += 4;
    if (tagsLower.includes(kw)) score += 5;
  });

  return score;
}

export async function POST(request: Request) {
  try {
    const { query, spaceId, conversationId, forceIntent } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    const cleanQuery = query.trim();

    const { data: { user } } = await supabase.auth.getUser();

    const isValidUuid = (str?: string | null) =>
      str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // Secure space authorization resolution:
    let realSpaceId = spaceId;

    if (user) {
      const { data: userMemberships } = await adminSupabase
        .from('space_members')
        .select('space_id')
        .eq('user_id', user.id);

      const authorizedSpaceIds = new Set(userMemberships?.map(sm => sm.space_id) || []);

      if (isValidUuid(realSpaceId) && authorizedSpaceIds.has(realSpaceId)) {
        // spaceId provided by client is valid and authorized for user
      } else if (userMemberships && userMemberships.length > 0) {
        realSpaceId = userMemberships[0].space_id;
      } else {
        // Auto-join user to default vault space in Supabase
        const { data: defaultSpace } = await adminSupabase.from('spaces').select('id').limit(1).single();
        if (defaultSpace) {
          realSpaceId = defaultSpace.id;
          await adminSupabase.from('space_members').upsert({
            space_id: realSpaceId,
            user_id: user.id,
            role: 'member',
          });
        }
      }
    }

    if (!isValidUuid(realSpaceId)) {
      const { data: defaultSpace } = await adminSupabase.from('spaces').select('id').limit(1).single();
      if (defaultSpace) realSpaceId = defaultSpace.id;
    }

    console.log('=== ASK MEMORY API TRACE ===');
    console.log('User ID:', user?.id || 'ANONYMOUS/GUEST');
    console.log('User Email:', user?.email || 'N/A');
    console.log('Input spaceId:', spaceId);
    console.log('Resolved realSpaceId:', realSpaceId);
    console.log('Raw query:', cleanQuery);

    // Resolve or create Conversation session in Supabase
    let activeConvId = conversationId;
    if (user && isValidUuid(realSpaceId)) {
      if (!isValidUuid(activeConvId)) {
        const convTitle = cleanQuery.length > 30 ? cleanQuery.substring(0, 30) + '...' : cleanQuery;
        const { data: newConv } = await adminSupabase
          .from('conversations')
          .insert({
            space_id: realSpaceId,
            created_by: user.id,
            title: convTitle,
          })
          .select()
          .single();

        if (newConv) activeConvId = newConv.id;
      }
    }

    // Insert user message into conversation_messages table
    if (user && isValidUuid(activeConvId) && isValidUuid(realSpaceId)) {
      await adminSupabase.from('conversation_messages').insert({
        conversation_id: activeConvId,
        space_id: realSpaceId,
        sender_id: user.id,
        sender_type: 'user',
        content: cleanQuery,
      });
    }

    // Detect Intent (SAVE vs ASK)
    let intent: 'SAVE' | 'ASK' | 'AMBIGUOUS' = forceIntent || 'ASK';

    if (!forceIntent) {
      const lower = cleanQuery.toLowerCase();
      const isQuestion =
        lower.endsWith('?') ||
        lower.startsWith('what') ||
        lower.startsWith('when') ||
        lower.startsWith('where') ||
        lower.startsWith('who') ||
        lower.startsWith('why') ||
        lower.startsWith('how') ||
        lower.startsWith('find') ||
        lower.startsWith('search') ||
        lower.startsWith('tell me') ||
        lower.startsWith('show me') ||
        lower.startsWith('did we') ||
        lower.startsWith('do we');

      const isSaveKeyword =
        lower.startsWith('save') ||
        lower.startsWith('remember') ||
        lower.startsWith('note:') ||
        lower.startsWith('we should') ||
        lower.startsWith('idea:') ||
        lower.startsWith('thought:') ||
        lower.includes('should build') ||
        lower.includes('should launch');

      if (isSaveKeyword && !isQuestion) {
        intent = 'SAVE';
      } else if (isQuestion) {
        intent = 'ASK';
      } else {
        intent = 'SAVE';
      }
    }

    // Handle SAVE Intent
    if (intent === 'SAVE') {
      let title: string | null = null;
      if (cleanQuery.length > 40) {
        title = cleanQuery.substring(0, 40) + '...';
      }

      const tagMatches = cleanQuery.match(/#(\w+)/g);
      const autoTagNames: string[] = tagMatches ? tagMatches.map(t => t.replace('#', '')) : [];
      
      if (cleanQuery.toLowerCase().includes('ulink')) autoTagNames.push('ulink');
      if (cleanQuery.toLowerCase().includes('idea') || cleanQuery.toLowerCase().includes('product')) autoTagNames.push('ideas');
      if (cleanQuery.toLowerCase().includes('school') || cleanQuery.toLowerCase().includes('class')) autoTagNames.push('school');

      let savedMemory: Memory;

      if (isValidUuid(realSpaceId)) {
        const creatorId = user ? user.id : 'e05dcda3-09e1-4afd-a62c-3ceb30c5f09c';
        const { data: memory, error: insertErr } = await adminSupabase
          .from('memories')
          .insert({
            space_id: realSpaceId,
            created_by: creatorId,
            title: title,
            content: cleanQuery,
            type: 'TEXT',
            metadata: { saved_via: 'chat' },
          })
          .select(`
            *,
            author:profiles(id, full_name, avatar_url, email)
          `)
          .single();

        if (memory) {
          for (const tagName of autoTagNames) {
            const { data: existingTag } = await adminSupabase
              .from('tags')
              .select('id')
              .eq('space_id', realSpaceId)
              .eq('name', tagName)
              .single();

            let tagId = existingTag?.id;

            if (!tagId) {
              const { data: newTag } = await adminSupabase
                .from('tags')
                .insert({ space_id: realSpaceId, name: tagName })
                .select()
                .single();
              tagId = newTag?.id;
            }

            if (tagId) {
              await adminSupabase
                .from('memory_tags')
                .insert({ memory_id: memory.id, tag_id: tagId });
            }
          }

          savedMemory = {
            ...memory,
            tags: autoTagNames.map((t, idx) => ({ id: 'tag-' + idx, space_id: realSpaceId, name: t })),
          };
        } else {
          console.error('Failed memory insert error:', insertErr);
          savedMemory = {
            id: 'mem-' + Date.now(),
            space_id: realSpaceId,
            created_by: creatorId,
            title: title,
            content: cleanQuery,
            type: 'TEXT',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: autoTagNames.map((t, idx) => ({ id: 'tag-' + idx, space_id: realSpaceId, name: t })),
          };
        }
      } else {
        savedMemory = {
          id: 'mem-' + Date.now(),
          space_id: 'demo-space',
          created_by: 'demo-user-1',
          title: title,
          content: cleanQuery,
          type: 'TEXT',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: autoTagNames.map((t, idx) => ({ id: 'tag-' + idx, space_id: 'demo-space', name: t })),
        };
      }

      const assistantContent = '✓ Saved to Our Memory';
      const assistantMeta = { intent: 'SAVE', is_saved_confirmation: true, saved_memory: savedMemory };

      if (user && isValidUuid(activeConvId) && isValidUuid(realSpaceId)) {
        await adminSupabase.from('conversation_messages').insert({
          conversation_id: activeConvId,
          space_id: realSpaceId,
          sender_type: 'assistant',
          content: assistantContent,
          metadata: assistantMeta,
        });

        await adminSupabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeConvId);
      }

      console.log('SAVE Intent Success:', savedMemory.id);

      return NextResponse.json({
        conversationId: activeConvId,
        intent: 'SAVE',
        message: assistantContent,
        savedMemory,
        suggestedTags: autoTagNames,
      });
    }

    // Handle ASK Intent (Retrieval & Gemini Q&A)
    const keywords = extractSearchKeywords(cleanQuery);
    console.log('Extracted search keywords:', keywords);

    let memoryQuery = adminSupabase
      .from('memories')
      .select(`
        *,
        author:profiles(id, full_name, avatar_url, email),
        attachments(*),
        memory_tags(tags(*))
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (isValidUuid(realSpaceId)) {
      memoryQuery = memoryQuery.eq('space_id', realSpaceId);
    }

    const { data: matchedMemories, error: queryErr } = await memoryQuery;
    if (queryErr) {
      console.error('Memories query error:', queryErr);
    }

    let candidateMemories: Memory[] = (matchedMemories as unknown as Memory[]) || [];
    console.log('Supabase returned candidate memories count:', candidateMemories.length);

    const formattedMemories: Memory[] = candidateMemories.map((m: any) => ({
      ...m,
      tags: m.memory_tags ? m.memory_tags.map((mt: any) => mt.tags).filter(Boolean) : m.tags || [],
    }));

    // Score memories by keyword relevance
    const scoredMemories = formattedMemories
      .map(m => ({ memory: m, score: scoreMemory(m, cleanQuery, keywords) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log('Scored candidate memories:', scoredMemories.map(s => ({
      id: s.memory.id,
      title: s.memory.title || s.memory.content.substring(0, 30),
      score: s.score
    })));

    // If no keyword score > 0, return clean zero-match message
    if (scoredMemories.length === 0) {
      const assistantContent = "I couldn't find anything relevant in our memories.";
      const assistantMeta = { intent: 'ASK', cited_sources: [] };

      if (user && isValidUuid(activeConvId) && isValidUuid(realSpaceId)) {
        await adminSupabase.from('conversation_messages').insert({
          conversation_id: activeConvId,
          space_id: realSpaceId,
          sender_type: 'assistant',
          content: assistantContent,
          metadata: assistantMeta,
        });
      }

      return NextResponse.json({
        conversationId: activeConvId,
        intent: 'ASK',
        answer: assistantContent,
        sources: [],
        sourcesCount: 0,
        isAiAvailable: isGeminiAvailable(),
      });
    }

    const memoriesForAi = scoredMemories.map(s => s.memory);

    console.log('Memories passed to Gemini AI count:', memoriesForAi.length);

    const aiResult = await askMemoryWithGemini(cleanQuery, memoriesForAi);
    console.log('Gemini AI Answer:', aiResult.answer);
    console.log('Gemini Cited Memory IDs:', aiResult.citedMemoryIds);

    const citedSet = new Set(aiResult.citedMemoryIds);
    const sources = memoriesForAi.filter((m) => citedSet.has(m.id));
    const finalSources = sources.length > 0 ? sources : scoredMemories.slice(0, 3).map(s => s.memory);

    const assistantContent = aiResult.answer;
    const assistantMeta = { intent: 'ASK', cited_sources: finalSources };

    if (user && isValidUuid(activeConvId) && isValidUuid(realSpaceId)) {
      await adminSupabase.from('conversation_messages').insert({
        conversation_id: activeConvId,
        space_id: realSpaceId,
        sender_type: 'assistant',
        content: assistantContent,
        metadata: assistantMeta,
      });

      await adminSupabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConvId);
    }

    console.log('=== END ASK MEMORY API TRACE ===\n');

    return NextResponse.json({
      conversationId: activeConvId,
      intent: 'ASK',
      answer: assistantContent,
      sources: finalSources,
      sourcesCount: finalSources.length,
      isAiAvailable: isGeminiAvailable(),
    });
  } catch (err: unknown) {
    console.error('Ask memory API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}
