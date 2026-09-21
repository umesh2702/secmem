import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/conversations?spaceId=... OR conversationId=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('spaceId');
    const conversationId = searchParams.get('conversationId');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isValidUuid = (str?: string | null) =>
      str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // If requesting messages for a specific conversation ID
    if (conversationId) {
      if (isValidUuid(conversationId)) {
        const { data: messages, error } = await supabase
          .from('conversation_messages')
          .select(`
            *,
            author:profiles(id, full_name, avatar_url, email)
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (!error && messages) {
          return NextResponse.json({ messages });
        }
      }
      return NextResponse.json({ messages: [] });
    }

    // Resolve real space_id if not valid UUID
    let targetSpaceId = spaceId;
    if (user && !isValidUuid(targetSpaceId)) {
      const { data: spaceMem } = await supabase
        .from('space_members')
        .select('space_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (spaceMem) targetSpaceId = spaceMem.space_id;
    }

    if (isValidUuid(targetSpaceId)) {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('space_id', targetSpaceId)
        .order('updated_at', { ascending: false });

      if (!error && conversations) {
        return NextResponse.json({ conversations });
      }
    }

    return NextResponse.json({ conversations: [] });
  } catch (err: unknown) {
    console.error('Conversations API GET error:', err);
    return NextResponse.json({ conversations: [], messages: [] });
  }
}

// POST /api/conversations (Create new conversation)
export async function POST(request: Request) {
  try {
    const { spaceId, title } = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isValidUuid = (str?: string | null) =>
      str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let targetSpaceId = spaceId;
    if (!isValidUuid(targetSpaceId)) {
      const { data: spaceMem } = await supabase
        .from('space_members')
        .select('space_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (spaceMem) targetSpaceId = spaceMem.space_id;
    }

    if (!isValidUuid(targetSpaceId)) {
      return NextResponse.json({ error: 'Valid space required' }, { status: 400 });
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        space_id: targetSpaceId,
        created_by: user.id,
        title: title || 'New Vault Chat',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ conversation });
  } catch (err: unknown) {
    console.error('Conversations API POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations (Deletes a chat conversation without touching memories)
export async function DELETE(request: Request) {
  try {
    const { conversationId } = await request.json();
    const supabase = await createClient();

    const isValidUuid = (str?: string | null) =>
      str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isValidUuid(conversationId)) {
      // Deletes ONLY conversation row (cascades to conversation_messages)
      // DOES NOT TOUCH memories, attachments, or tags!
      await supabase.from('conversations').delete().eq('id', conversationId);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Conversations API DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
