-- ==========================================
-- OUR MEMORY - PRODUCTION SUPABASE DATABASE SCHEMA
-- Fully Idempotent & Safely Rerunnable
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------
-- 1. TABLES PROVISIONING
-- ------------------------------------------

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- SPACES TABLE (Shared Memory Vaults)
CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.space_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(space_id, user_id)
);

-- MEMORIES TABLE
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TEXT', 'IMAGE', 'LINK', 'FILE')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TAGS TABLE
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(space_id, name)
);

-- MEMORY TAGS (Junction Table)
CREATE TABLE IF NOT EXISTS public.memory_tags (
  memory_id UUID NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, tag_id)
);

-- CONVERSATIONS TABLE (Chat Sessions)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Memory Vault Conversation',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CONVERSATION MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------
-- 2. INDEXES
-- ------------------------------------------
CREATE INDEX IF NOT EXISTS idx_memories_space_id ON public.memories(space_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON public.memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_created_by ON public.memories(created_by);
CREATE INDEX IF NOT EXISTS idx_memories_type ON public.memories(type);
CREATE INDEX IF NOT EXISTS idx_space_members_user ON public.space_members(user_id);
CREATE INDEX IF NOT EXISTS idx_space_members_space ON public.space_members(space_id);
CREATE INDEX IF NOT EXISTS idx_attachments_memory ON public.attachments(memory_id);
CREATE INDEX IF NOT EXISTS idx_conversations_space ON public.conversations(space_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON public.conversation_messages(conversation_id);

-- ------------------------------------------
-- 3. FUNCTIONS & TRIGGERS
-- ------------------------------------------

-- Auto-create Profile and Global Space Membership on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  global_space_id_const UUID := '6095b18e-bcc1-405d-9654-b046dc0f5d3e';
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  -- Auto-join new user to the global memory vault space
  INSERT INTO public.space_members (space_id, user_id, role)
  VALUES (global_space_id_const, new.id, 'member')
  ON CONFLICT (space_id, user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security Definer Helper: Check Space Membership safely
CREATE OR REPLACE FUNCTION public.is_member_of_space(check_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = check_space_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security Definer Helper: Verify Private Storage File Access
CREATE OR REPLACE FUNCTION public.can_access_storage_object(object_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  folder_space_id_str TEXT;
BEGIN
  folder_space_id_str := (storage.foldername(object_name))[1];
  IF folder_space_id_str IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.is_member_of_space(folder_space_id_str::uuid);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view profiles in their space" ON public.profiles;
CREATE POLICY "Users can view profiles in their space" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.space_members sm1
      JOIN public.space_members sm2 ON sm1.space_id = sm2.space_id
      WHERE sm1.user_id = auth.uid() AND sm2.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- SPACES POLICIES
DROP POLICY IF EXISTS "Users can view spaces they belong to" ON public.spaces;
CREATE POLICY "Users can view spaces they belong to" ON public.spaces
  FOR SELECT USING (public.is_member_of_space(id));

DROP POLICY IF EXISTS "Authenticated users can create space" ON public.spaces;
CREATE POLICY "Authenticated users can create space" ON public.spaces
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Space owners can update space" ON public.spaces;
CREATE POLICY "Space owners can update space" ON public.spaces
  FOR UPDATE USING (created_by = auth.uid());

-- SPACE_MEMBERS POLICIES
DROP POLICY IF EXISTS "Users can view members of their spaces" ON public.space_members;
CREATE POLICY "Users can view members of their spaces" ON public.space_members
  FOR SELECT USING (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can join or add space members" ON public.space_members;
CREATE POLICY "Users can join or add space members" ON public.space_members
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Space owners can delete members" ON public.space_members;
CREATE POLICY "Space owners can delete members" ON public.space_members
  FOR DELETE USING (public.is_member_of_space(space_id));

-- MEMORIES POLICIES
DROP POLICY IF EXISTS "Users can view memories in their space" ON public.memories;
CREATE POLICY "Users can view memories in their space" ON public.memories
  FOR SELECT USING (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can create memories in their space" ON public.memories;
CREATE POLICY "Users can create memories in their space" ON public.memories
  FOR INSERT WITH CHECK (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can update memories in their space" ON public.memories;
CREATE POLICY "Users can update memories in their space" ON public.memories
  FOR UPDATE USING (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can delete memories in their space" ON public.memories;
CREATE POLICY "Users can delete memories in their space" ON public.memories
  FOR DELETE USING (public.is_member_of_space(space_id));

-- ATTACHMENTS POLICIES
DROP POLICY IF EXISTS "Users can view attachments for space memories" ON public.attachments;
CREATE POLICY "Users can view attachments for space memories" ON public.attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memories
      WHERE memories.id = attachments.memory_id AND public.is_member_of_space(memories.space_id)
    )
  );

DROP POLICY IF EXISTS "Users can insert attachments for space memories" ON public.attachments;
CREATE POLICY "Users can insert attachments for space memories" ON public.attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memories
      WHERE memories.id = attachments.memory_id AND public.is_member_of_space(memories.space_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete attachments for space memories" ON public.attachments;
CREATE POLICY "Users can delete attachments for space memories" ON public.attachments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.memories
      WHERE memories.id = attachments.memory_id AND public.is_member_of_space(memories.space_id)
    )
  );

-- TAGS POLICIES
DROP POLICY IF EXISTS "Users can view tags in their space" ON public.tags;
CREATE POLICY "Users can view tags in their space" ON public.tags
  FOR SELECT USING (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can create tags in their space" ON public.tags;
CREATE POLICY "Users can create tags in their space" ON public.tags
  FOR INSERT WITH CHECK (public.is_member_of_space(space_id));

-- MEMORY_TAGS POLICIES
DROP POLICY IF EXISTS "Users can view memory tags" ON public.memory_tags;
CREATE POLICY "Users can view memory tags" ON public.memory_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memories
      WHERE memories.id = memory_tags.memory_id AND public.is_member_of_space(memories.space_id)
    )
  );

DROP POLICY IF EXISTS "Users can insert memory tags" ON public.memory_tags;
CREATE POLICY "Users can insert memory tags" ON public.memory_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memories
      WHERE memories.id = memory_tags.memory_id AND public.is_member_of_space(memories.space_id)
    )
  );

-- CONVERSATIONS POLICIES
DROP POLICY IF EXISTS "Users can view conversations in their space" ON public.conversations;
CREATE POLICY "Users can view conversations in their space" ON public.conversations
  FOR SELECT USING (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can create conversations in their space" ON public.conversations;
CREATE POLICY "Users can create conversations in their space" ON public.conversations
  FOR INSERT WITH CHECK (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can update conversations in their space" ON public.conversations;
CREATE POLICY "Users can update conversations in their space" ON public.conversations
  FOR UPDATE USING (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can delete conversations in their space" ON public.conversations;
CREATE POLICY "Users can delete conversations in their space" ON public.conversations
  FOR DELETE USING (public.is_member_of_space(space_id));

-- CONVERSATION_MESSAGES POLICIES
DROP POLICY IF EXISTS "Users can view conversation messages in their space" ON public.conversation_messages;
CREATE POLICY "Users can view conversation messages in their space" ON public.conversation_messages
  FOR SELECT USING (public.is_member_of_space(space_id));

DROP POLICY IF EXISTS "Users can insert conversation messages in their space" ON public.conversation_messages;
CREATE POLICY "Users can insert conversation messages in their space" ON public.conversation_messages
  FOR INSERT WITH CHECK (public.is_member_of_space(space_id));

-- ------------------------------------------
-- 5. PRIVATE SUPABASE STORAGE BUCKET & RLS
-- ------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('memory-files', 'memory-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Scoped storage upload for memory space" ON storage.objects;
CREATE POLICY "Scoped storage upload for memory space" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'memory-files' AND public.can_access_storage_object(name)
  );

DROP POLICY IF EXISTS "Scoped storage download for memory space" ON storage.objects;
CREATE POLICY "Scoped storage download for memory space" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'memory-files' AND public.can_access_storage_object(name)
  );

DROP POLICY IF EXISTS "Scoped storage delete for memory space" ON storage.objects;
CREATE POLICY "Scoped storage delete for memory space" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'memory-files' AND public.can_access_storage_object(name)
  );
