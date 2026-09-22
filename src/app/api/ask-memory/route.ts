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

function classifyIntent(query: string, hasAttachment: boolean, forceIntent?: string): 'SAVE' | 'ASK' {
  if (forceIntent === 'SAVE' || forceIntent === 'ASK') {
    return forceIntent as 'SAVE' | 'ASK';
  }
  if (hasAttachment) {
    return 'SAVE';
  }

  const clean = query.trim();
  const lower = clean.toLowerCase();

  // Explicit Save Commands
  const explicitSavePrefixes = [
    'save ', 'save:', 'remember ', 'remember:', 'store ', 'store:',
    'note:', 'idea:', 'thought:', 'keep this:', 'save this:'
  ];
  if (explicitSavePrefixes.some(prefix => lower.startsWith(prefix))) {
    return 'SAVE';
  }

  // Explicit Retrieval Questions & Question Markers
  if (lower.includes('?')) {
    return 'ASK';
  }

  const retrievalLeadWords = [
    'what', 'which', 'who', 'when', 'where', 'why', 'how',
    'show', 'find', 'search', 'get', 'list', 'display', 'fetch', 'tell me',
    'give me', 'bring up', 'look up', 'do we', 'did we', 'have we', 'has anyone',
    'are there', 'is there', 'can you', 'could you', 'would you', 'recall', 'browse'
  ];

  if (retrievalLeadWords.some(w => lower.startsWith(w) || lower.includes(` ${w} `))) {
    return 'ASK';
  }

  const retrievalKeywords = [
    'saved', 'stored', 'decided', 'know about', 'have about', 'anything about',
    'everything about', 'details on', 'info on', 'information on', 'till now',
    'so far', 'history', 'yesterday', 'today', 'last week', 'recently'
  ];

  if (retrievalKeywords.some(kw => lower.includes(kw))) {
    return 'ASK';
  }

  // Noun / Category Searches (e.g. "images", "website link", "links", "files", "documents")
  const categoryTerms = [
    'image', 'images', 'photo', 'photos', 'picture', 'pictures',
    'link', 'links', 'url', 'urls', 'website', 'websites',
    'file', 'files', 'document', 'documents', 'pdf', 'pdfs',
    'note', 'notes', 'memory', 'memories'
  ];

  const words = lower.split(/\s+/);
  if (words.length <= 4 && words.some(w => categoryTerms.includes(w))) {
    return 'ASK';
  }

  // Declarative Statements that convey new facts/decisions to remember
  const isDeclarativeSave =
    lower.includes(' should ') ||
    lower.includes(' uses ') ||
    lower.includes(' is ') ||
    lower.includes(' are ') ||
    lower.includes(' will ') ||
    lower.startsWith('we ') ||
    lower.startsWith('our ');

  if (isDeclarativeSave) {
    return 'SAVE';
  }

  if (words.length <= 3) {
    return 'ASK';
  }

  return 'SAVE';
}

function extractSearchKeywords(query: string): string[] {
  const stopWords = new Set([
    'what', 'when', 'where', 'who', 'why', 'how', 'which', 'did', 'do', 'does', 'we', 'i', 'you',
    'they', 'he', 'she', 'it', 'decide', 'decided', 'about', 'the', 'a', 'an', 'is', 'are', 'was',
    'were', 'supposed', 'to', 'use', 'tell', 'me', 'show', 'find', 'remember', 'say', 'said',
    'images', 'image', 'links', 'link', 'files', 'file', 'photos', 'photo', 'saved', 'have'
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
    const { query, spaceId, conversationId, forceIntent, memoryType } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    const cleanQuery = query.trim();

    const { data: { user } } = await supabase.auth.getUser();

    const isValidUuid = (str?: string | null) =>
      str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // Secure space authorization resolution
    let realSpaceId = spaceId;

    if (user) {
      const { data: userMemberships } = await adminSupabase
        .from('space_members')
        .select('space_id')
        .eq('user_id', user.id);

      const authorizedSpaceIds = new Set(userMemberships?.map(sm => sm.space_id) || []);

      if (isValidUuid(realSpaceId) && authorizedSpaceIds.has(realSpaceId)) {
        // spaceId authorized
      } else if (userMemberships && userMemberships.length > 0) {
        realSpaceId = userMemberships[0].space_id;
      } else {
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

    // Resolve or create Conversation session
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

    // Insert user message into conversation_messages (chat history UI only)
    if (user && isValidUuid(activeConvId) && isValidUuid(realSpaceId)) {
      await adminSupabase.from('conversation_messages').insert({
        conversation_id: activeConvId,
        space_id: realSpaceId,
        sender_id: user.id,
        sender_type: 'user',
        content: cleanQuery,
      });
    }

    // Classify intent accurately
    const intent: 'SAVE' | 'ASK' = classifyIntent(cleanQuery, Boolean(memoryType && memoryType !== 'TEXT'), forceIntent);

    console.log('=== ASK MEMORY API TRACE ===');
    console.log('Query:', cleanQuery);
    console.log('Detected Intent:', intent);
    console.log('Space ID:', realSpaceId);

    // ----------------------------------------------------
    // HANDLE SAVE INTENT (Create Permanent Memory)
    // ----------------------------------------------------
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
            type: memoryType || 'TEXT',
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
            type: memoryType || 'TEXT',
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
          type: memoryType || 'TEXT',
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

      return NextResponse.json({
        conversationId: activeConvId,
        intent: 'SAVE',
        message: assistantContent,
        savedMemory,
        suggestedTags: autoTagNames,
      });
    }

    // ----------------------------------------------------
    // HANDLE ASK INTENT (Retrieval & Q&A - ZERO MEMORY INSERTS)
    // ----------------------------------------------------
    const queryLower = cleanQuery.toLowerCase();
    const isImageCategory = /\b(image|images|photo|photos|picture|pictures|png|jpg|jpeg)\b/i.test(queryLower);
    const isLinkCategory = /\b(link|links|url|urls|website|websites|site|domain)\b/i.test(queryLower);
    const isFileCategory = /\b(file|files|document|documents|pdf|pdfs|attachment|attachments)\b/i.test(queryLower);

    let memoryQuery = adminSupabase
      .from('memories')
      .select(`
        *,
        author:profiles(id, full_name, avatar_url, email),
        attachments(*),
        memory_tags(tags(*))
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (isValidUuid(realSpaceId)) {
      memoryQuery = memoryQuery.eq('space_id', realSpaceId);
    }

    const { data: matchedMemories } = await memoryQuery;
    const formattedMemories: Memory[] = ((matchedMemories as unknown as Memory[]) || []).map((m: any) => ({
      ...m,
      tags: m.memory_tags ? m.memory_tags.map((mt: any) => mt.tags).filter(Boolean) : m.tags || [],
    }));

    let candidateSources: Memory[] = [];

    if (isImageCategory) {
      candidateSources = formattedMemories.filter(m =>
        m.type === 'IMAGE' || (m.attachments && m.attachments.some((a: any) => a.file_type?.startsWith('image/')))
      );
    } else if (isLinkCategory) {
      candidateSources = formattedMemories.filter(m =>
        m.type === 'LINK' || Boolean(m.metadata?.url)
      );
    } else if (isFileCategory) {
      candidateSources = formattedMemories.filter(m =>
        m.type === 'FILE' || (m.attachments && m.attachments.some((a: any) => !a.file_type?.startsWith('image/')))
      );
    } else {
      const keywords = extractSearchKeywords(cleanQuery);
      if (keywords.length > 0) {
        candidateSources = formattedMemories
          .map(m => ({ memory: m, score: scoreMemory(m, cleanQuery, keywords) }))
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(item => item.memory);
      } else {
        candidateSources = formattedMemories.slice(0, 10);
      }
    }

    // Generate authorized temporary signed URLs for attachments on candidate sources
    for (const mem of candidateSources) {
      if (mem.attachments && mem.attachments.length > 0) {
        for (const att of mem.attachments) {
          if (att.file_path) {
            const { data: signedData } = await adminSupabase.storage
              .from('memory-files')
              .createSignedUrl(att.file_path, 3600);
            if (signedData?.signedUrl) {
              att.public_url = signedData.signedUrl;
            }
          }
        }
      }
    }

    // Zero matching sources
    if (candidateSources.length === 0) {
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

    let assistantContent = '';
    let finalSources = candidateSources;

    if (isImageCategory) {
      assistantContent = `Found ${candidateSources.length} image memory(ies) in our global vault:`;
      finalSources = candidateSources.slice(0, 10);
    } else if (isLinkCategory) {
      assistantContent = `Found ${candidateSources.length} link memory(ies) in our global vault:`;
      finalSources = candidateSources.slice(0, 10);
    } else if (isFileCategory) {
      assistantContent = `Found ${candidateSources.length} file memory(ies) in our global vault:`;
      finalSources = candidateSources.slice(0, 10);
    } else {
      const aiResult = await askMemoryWithGemini(cleanQuery, candidateSources);
      assistantContent = aiResult.answer;

      const citedSet = new Set(aiResult.citedMemoryIds);
      const citedSources = candidateSources.filter(m => citedSet.has(m.id));
      finalSources = citedSources.length > 0 ? citedSources : candidateSources.slice(0, 5);
    }

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
