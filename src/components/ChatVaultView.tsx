'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Paperclip,
  Plus,
  CheckCircle2,
  ArrowUpRight,
  BookOpen,
  Copy,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  MoreVertical,
  Check,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
} from 'lucide-react';
import { ChatMessage, Memory, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface ChatVaultViewProps {
  spaceId: string | null;
  currentUser: Profile | null;
  activeConversationId: string | null;
  onConversationCreated: (convId: string) => void;
  onSelectMemory: (m: Memory) => void;
  onMemoryCreated: () => void;
  onOpenAddModal: () => void;
}

const STORAGE_KEY = 'our_memory_active_chat_messages_v4';

// Component for rendering individual Source Cards inside Chat Vault assistant responses
function ChatSourceCard({ src, onSelectMemory }: { src: Memory; onSelectMemory: (m: Memory) => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    // Check if signed URL is already attached to attachments or metadata
    const att = src.attachments?.find((a) => a.file_type?.startsWith('image/') || a.file_path);
    const meta = src.metadata as Record<string, any> | null;
    if (att?.public_url) {
      setSignedUrl(att.public_url);
    } else if (att?.file_path) {
      supabase.storage
        .from('memory-files')
        .createSignedUrl(att.file_path, 3600)
        .then(({ data }) => {
          if (isMounted && data?.signedUrl) {
            setSignedUrl(data.signedUrl);
          }
        });
    } else if (meta?.url && typeof meta.url === 'string' && (src.type === 'IMAGE' || meta.url.match(/\.(jpeg|jpg|gif|png|webp)/i))) {
      setSignedUrl(meta.url);
    } else if (meta?.imageUrl && typeof meta.imageUrl === 'string') {
      setSignedUrl(meta.imageUrl);
    }

    return () => {
      isMounted = false;
    };
  }, [src, supabase]);

  const isImage = src.type === 'IMAGE' || Boolean(src.attachments?.some((a) => a.file_type?.startsWith('image/')));
  const isLink = src.type === 'LINK';

  const formattedDate = new Date(src.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={() => onSelectMemory(src)}
      className="bg-[#121620] border border-[#1E2536] hover:border-[#C6FF00]/50 rounded-xl p-3 flex flex-col justify-between gap-2.5 cursor-pointer group transition-all"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          {isImage ? (
            <div className="w-full h-24 rounded-lg bg-[#0A0D14] border border-[#1E2536] overflow-hidden relative flex items-center justify-center shrink-0">
              {signedUrl && !imgError ? (
                <img
                  src={signedUrl}
                  alt={src.title || 'Source Image'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                  <ImageIcon className="w-5 h-5 text-slate-500" />
                  <span className="text-[10px] font-mono">Image Source</span>
                </div>
              )}
            </div>
          ) : isLink ? (
            <div className="p-2 rounded-lg bg-[#0A0D14] border border-[#1E2536]">
              <LinkIcon className="w-4 h-4 text-amber-400" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-[#0A0D14] border border-[#1E2536]">
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
          )}
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#C6FF00] shrink-0" />
        </div>

        <h4 className="text-xs font-bold text-white group-hover:text-[#C6FF00] transition-colors line-clamp-1">
          {src.title || src.content.substring(0, 30)}
        </h4>

        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
          {src.content}
        </p>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-[#1E2536]/60 mt-auto">
        <span className="px-2 py-0.5 rounded-full bg-[#182030] text-slate-300 font-bold uppercase tracking-wider text-[9px]">
          {src.type || 'NOTE'}
        </span>
        <span className="font-mono">{formattedDate}</span>
      </div>
    </div>
  );
}

export default function ChatVaultView({
  spaceId,
  currentUser,
  activeConversationId,
  onConversationCreated,
  onSelectMemory,
  onMemoryCreated,
  onOpenAddModal,
}: ChatVaultViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<{ [msgId: string]: boolean }>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const toggleExpandSources = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Default seed response matching reference design when asking about ULink
  const defaultInitialMessages: ChatMessage[] = [
    {
      id: 'msg-user-ulink-demo',
      conversation_id: 'default',
      space_id: spaceId || '',
      sender_type: 'user',
      content: 'What did we decide about ULink?',
      created_at: new Date().toISOString(),
    },
    {
      id: 'msg-asst-ulink-demo',
      conversation_id: 'default',
      space_id: spaceId || '',
      sender_type: 'assistant',
      content:
        "Here's what we've decided about ULink based on our saved memories:\n\n1. ULink should use **NFC and QR** for customer engagement.\n2. The prototype includes the **restaurant logo** at the top of the display.\n3. It's a physical display stand placed at checkout to capture **reviews, Instagram follows, and website visits**.\n4. First client sample is **Itihaas Restaurant and Banquets**.",
      metadata: {
        intent: 'ASK',
        cited_sources: [
          {
            id: 'src-1',
            space_id: spaceId || 'demo-space',
            created_by: 'demo-user',
            title: 'ULink prototype design',
            content: 'Physical display stand with QR code and NFC logo placed at checkout to capture customer reviews and website visits.',
            type: 'IMAGE',
            created_at: '2026-09-22T10:00:00Z',
            updated_at: '2026-09-22T10:00:00Z',
            tags: [{ id: 't1', space_id: 'demo-space', name: 'ulink' }],
          },
          {
            id: 'src-2',
            space_id: spaceId || 'demo-space',
            created_by: 'demo-user',
            title: 'Itihaas client sample',
            content: 'First client for ULink prototype stand: Itihaas Restaurant and Banquets.',
            type: 'IMAGE',
            created_at: '2026-09-22T10:00:00Z',
            updated_at: '2026-09-22T10:00:00Z',
            tags: [{ id: 't1', space_id: 'demo-space', name: 'ulink' }],
          },
          {
            id: 'src-3',
            space_id: spaceId || 'demo-space',
            created_by: 'demo-user',
            title: 'ULink features',
            content: '✓ Use NFC and QR\n✓ Capture reviews, Instagram follows\n✓ Place at checkout\n✓ Product by UCreates',
            type: 'TEXT',
            created_at: '2026-09-22T10:00:00Z',
            updated_at: '2026-09-22T10:00:00Z',
            tags: [{ id: 't1', space_id: 'demo-space', name: 'ulink' }],
          },
        ],
      },
      created_at: new Date().toISOString(),
    },
  ];

  // Load messages from Supabase (Authoritative Source of Truth)
  const loadMessagesFromSupabase = useCallback(async (convId?: string | null) => {
    const targetConvId = convId || activeConversationId;
    if (!targetConvId) {
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
              return;
            }
          }
        } catch {
          // ignore cache error
        }
      }
      setMessages(defaultInitialMessages);
      return;
    }

    setFetchingHistory(true);
    try {
      const res = await fetch(`/api/conversations?conversationId=${targetConvId}`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.messages));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch messages from Supabase:', err);
    } finally {
      setFetchingHistory(false);
    }
  }, [activeConversationId, spaceId]);

  useEffect(() => {
    loadMessagesFromSupabase();
  }, [activeConversationId, loadMessagesFromSupabase]);

  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (err) {
        console.warn('Cache error:', err);
      }
    }
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() && !attachment) return;

    const userMessageText = text.trim();
    const isImage = attachment ? attachment.type.startsWith('image/') : false;
    const memoryType = attachment ? (isImage ? 'IMAGE' : 'FILE') : 'TEXT';

    let queryToSend = userMessageText;
    if (!queryToSend && attachment) {
      queryToSend = isImage
        ? `Remember the attached image: ${attachment.name}`
        : `Remember the attached file: ${attachment.name}`;
    }

    const userMsgId = 'user-msg-' + Date.now();
    const GLOBAL_SPACE_ID = '6095b18e-bcc1-405d-9654-b046dc0f5d3e';
    const activeSpaceId = spaceId || GLOBAL_SPACE_ID;

    const newUserMessage: ChatMessage = {
      id: userMsgId,
      conversation_id: activeConversationId || 'default',
      space_id: activeSpaceId,
      sender_id: currentUser?.id,
      sender_type: 'user',
      content: userMessageText || (attachment ? `Attached ${isImage ? 'image' : 'file'}: ${attachment.name}` : ''),
      created_at: new Date().toISOString(),
      author: currentUser || undefined,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const res = await fetch('/api/ask-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToSend,
          spaceId: activeSpaceId,
          conversationId: activeConversationId || null,
          forceIntent: attachment ? 'SAVE' : undefined,
          memoryType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process chat message');

      if (data.conversationId && data.conversationId !== activeConversationId) {
        onConversationCreated(data.conversationId);
      }

      if (attachment && data.savedMemory) {
        const supabase = createClient();
        const filePath = `${activeSpaceId}/${data.savedMemory.id}/${Date.now()}_${attachment.name}`;

        const { error: uploadErr } = await supabase.storage
          .from('memory-files')
          .upload(filePath, attachment);

        if (uploadErr) {
          throw new Error(`Failed to upload attachment: ${uploadErr.message}`);
        }

        const { data: attRecord, error: attErr } = await supabase
          .from('attachments')
          .insert({
            memory_id: data.savedMemory.id,
            file_name: attachment.name,
            file_path: filePath,
            file_type: attachment.type || 'application/octet-stream',
            file_size: attachment.size,
            public_url: null,
          })
          .select()
          .single();

        if (attErr) {
          console.error('Failed to create attachment DB record:', attErr);
          throw new Error(`Failed to save attachment metadata: ${attErr.message}`);
        }

        if (attRecord && data.savedMemory) {
          data.savedMemory.attachments = [attRecord];
        }
      }

      setInput('');
      setAttachment(null);

      if (data.intent === 'SAVE' && data.savedMemory) {
        const systemMsg: ChatMessage = {
          id: 'asst-save-' + Date.now(),
          conversation_id: data.conversationId || activeConversationId || 'default',
          space_id: activeSpaceId,
          sender_type: 'assistant',
          content: '✓ Saved to Our Memory',
          metadata: {
            intent: 'SAVE',
            is_saved_confirmation: true,
            saved_memory: data.savedMemory,
          },
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMsg]);
        onMemoryCreated();
      } else {
        const assistantMsg: ChatMessage = {
          id: 'asst-ask-' + Date.now(),
          conversation_id: data.conversationId || activeConversationId || 'default',
          space_id: activeSpaceId,
          sender_type: 'assistant',
          content: data.answer || "I couldn't find anything relevant in our memories.",
          metadata: {
            intent: 'ASK',
            cited_sources: data.sources || [],
          },
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: unknown) {
      console.error('Chat processing error:', err);
      const usefulError = err instanceof Error ? err.message : 'Sorry, an error occurred while processing your request.';
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        conversation_id: activeConversationId || 'default',
        space_id: activeSpaceId,
        sender_type: 'assistant',
        content: `Error: ${usefulError}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, title: 'New Vault Chat' }),
      });
      const data = await res.json();
      if (data.conversation?.id) {
        onConversationCreated(data.conversation.id);
      }
    } catch {
      // fallback
    }

    setMessages([
      {
        id: 'welcome-' + Date.now(),
        conversation_id: 'default',
        space_id: spaceId || '',
        sender_type: 'assistant',
        content:
          'New chat initialized. Type anything to remember it permanently in our shared vault, or ask a question to retrieve memories.',
        created_at: new Date().toISOString(),
      },
    ]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format assistant text bold formatting
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={idx} className={line.trim() === '' ? 'h-2' : ''}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-bold text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0E121B] border border-[#1E2536] rounded-3xl overflow-hidden shadow-2xl">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-[#1E2536] bg-[#0A0D14] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1A2608] border border-[#C6FF00]/50 flex items-center justify-center text-[#C6FF00] shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight leading-none">
              Conversational Memory Vault
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-normal">
              Ask questions or save important information to our shared vault
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleNewChat}
            className="text-xs text-slate-200 hover:text-white px-3.5 py-1.5 rounded-full bg-[#182030] hover:bg-[#202B40] border border-[#2B354C] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
          <button className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Container */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6 custom-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.sender_type === 'user';
          const sources = msg.metadata?.cited_sources || [];

          return (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-[#1A2608] border border-[#C6FF00]/50 flex items-center justify-center text-[#C6FF00] shrink-0 mt-0.5 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-3xl space-y-3.5 ${isUser ? 'items-end' : 'items-start'} flex-1`}>
                {/* Message Bubble Container */}
                <div className="relative group">
                  <div
                    className={`p-4 rounded-2xl text-xs md:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#C6FF00] text-black font-semibold rounded-tr-xs shadow-lg shadow-[#C6FF00]/10 ml-auto max-w-xl'
                        : 'bg-transparent text-slate-200 pl-0 pt-0'
                    }`}
                  >
                    {isUser ? (
                      <div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 text-[10px] text-black/60 font-mono mt-1">
                          <span>12:18 PM</span>
                          <span className="font-bold">✓✓</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Top action toolbar for assistant messages */}
                        <div className="flex items-center justify-between text-slate-400 border-b border-[#1E2536]/40 pb-2 mb-2">
                          <span className="text-[11px] font-medium text-slate-400">Response</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyText(msg.content, msg.id)}
                              title="Copy response"
                              className="p-1 hover:text-white transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-[#C6FF00]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button className="p-1 hover:text-white transition-colors">
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 hover:text-white transition-colors">
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 hover:text-white transition-colors">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {renderFormattedContent(msg.content)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Saved Confirmation */}
                {msg.metadata?.is_saved_confirmation && msg.metadata.saved_memory && (
                  <div
                    onClick={() => onSelectMemory(msg.metadata!.saved_memory!)}
                    className="p-4 rounded-2xl bg-[#0A0D14] border border-[#C6FF00]/40 hover:border-[#C6FF00] transition-colors cursor-pointer space-y-2 shadow-lg max-w-xl"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#C6FF00] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Memory Saved to Shared Vault</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-semibold">
                      {msg.metadata.saved_memory.title || msg.metadata.saved_memory.content}
                    </p>
                  </div>
                )}

                {/* Sources Card Section */}
                {sources.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#0A0D14] border border-[#1E2536] space-y-3.5 w-full">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <BookOpen className="w-4 h-4 text-[#C6FF00]" />
                        <span>Sources from Our Memory ({sources.length})</span>
                      </div>
                      {sources.length > 3 && (
                        <button
                          onClick={() => toggleExpandSources(msg.id)}
                          className="text-xs font-semibold text-[#C6FF00] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>{Boolean(expandedSources[msg.id]) ? 'Show less' : 'View all'}</span>
                          <ArrowUpRight className={`w-3.5 h-3.5 transition-transform ${Boolean(expandedSources[msg.id]) ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Sources Grid: Displays 3 cards by default, expands when View All is clicked */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(Boolean(expandedSources[msg.id]) ? sources : sources.slice(0, 3)).map((src: Memory, idx: number) => (
                        <ChatSourceCard key={src.id || idx} src={src} onSelectMemory={onSelectMemory} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Action Prompt Suggestion Buttons */}
                {!isUser && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => handleSendMessage('Show more about ULink')}
                      className="px-3.5 py-1.5 rounded-full bg-[#1A2608]/40 hover:bg-[#1A2608] border border-[#C6FF00] text-[#C6FF00] text-xs font-semibold transition-all cursor-pointer shadow-sm"
                    >
                      Show more about ULink
                    </button>
                    <button
                      onClick={() => handleSendMessage('Show all images')}
                      className="px-3.5 py-1.5 rounded-full bg-[#121620] hover:bg-[#182030] border border-[#1E2536] text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                    >
                      Show all images
                    </button>
                    <button
                      onClick={() => handleSendMessage('What links do we have?')}
                      className="px-3.5 py-1.5 rounded-full bg-[#121620] hover:bg-[#182030] border border-[#1E2536] text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                    >
                      What links do we have?
                    </button>
                    <button
                      onClick={() => handleSendMessage('Show latest decisions')}
                      className="px-3.5 py-1.5 rounded-full bg-[#121620] hover:bg-[#182030] border border-[#1E2536] text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                    >
                      Show latest decisions
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-[#182030] border border-[#2B354C] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                  U
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#C6FF00] font-semibold p-3 bg-[#1A2608]/30 border border-[#C6FF00]/30 rounded-2xl max-w-sm">
            <Sparkles className="w-4 h-4 animate-spin text-[#C6FF00]" />
            <span>Searching memory vault...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Composer Bar matching reference screenshot */}
      <div className="p-4 bg-[#0A0D14] border-t border-[#1E2536]">
        {attachment && (
          <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-xl bg-[#121620] border border-[#1E2536] text-xs text-slate-300">
            <span className="truncate">Attached: {attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-slate-400 hover:text-white text-xs">
              Remove
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2.5 bg-[#121620] border border-[#1E2536] rounded-2xl p-2 shadow-inner focus-within:border-[#C6FF00]/60 transition-all"
        >
          <button
            type="button"
            onClick={onOpenAddModal}
            title="Create memory modal"
            className="p-2.5 rounded-xl bg-[#182030] hover:bg-[#202B40] text-white transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>

          <label
            title="Attach file"
            className="p-2.5 rounded-xl bg-[#182030] hover:bg-[#202B40] text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <Paperclip className="w-4 h-4" />
            <input
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setAttachment(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </label>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type something to remember or ask a question..."
            className="flex-1 bg-transparent px-2 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={loading || (!input.trim() && !attachment)}
            className="bg-[#C6FF00] hover:bg-[#b5f800] text-black font-bold rounded-xl px-4 py-2.5 text-xs transition-all flex items-center gap-1.5 shadow-md shadow-[#C6FF00]/15 disabled:opacity-30 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5 fill-black" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

