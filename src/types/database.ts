export type MemoryType = 'TEXT' | 'IMAGE' | 'LINK' | 'FILE';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Space {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile?: Profile;
}

export interface Attachment {
  id: string;
  memory_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  public_url?: string;
  created_at: string;
}

export interface Tag {
  id: string;
  space_id: string;
  name: string;
  created_at?: string;
}

export interface Memory {
  id: string;
  space_id: string;
  created_by: string;
  title: string | null;
  content: string;
  type: MemoryType;
  metadata?: {
    url?: string;
    domain?: string;
    ai_description?: string;
    og_title?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
  author?: Profile;
  attachments?: Attachment[];
  tags?: Tag[];
}

export interface Conversation {
  id: string;
  space_id: string;
  created_by: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  space_id: string;
  sender_id?: string;
  sender_type: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    intent?: 'SAVE' | 'ASK' | 'AMBIGUOUS';
    saved_memory?: Memory;
    cited_sources?: Memory[];
    is_saved_confirmation?: boolean;
    attachment_urls?: string[];
    [key: string]: unknown;
  };
  created_at: string;
  author?: Profile;
}

export interface Theme {
  name: string;
  memoryCount: number;
  recentMemories: Memory[];
  tags: Tag[];
}

export interface AskAnswer {
  answer: string;
  sources: Memory[];
  sourcesCount: number;
  isAiAvailable: boolean;
}
