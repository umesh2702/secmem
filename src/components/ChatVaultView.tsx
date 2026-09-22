'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Paperclip, Plus, CheckCircle2, ArrowUpRight, BookOpen, ShieldCheck, RefreshCw, Trash2 } from 'lucide-react';
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

const STORAGE_KEY = 'our_memory_active_chat_messages_v3';

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
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      setMessages([
        {
          id: 'welcome-1',
          conversation_id: 'default',
          space_id: spaceId || '',
          sender_type: 'assistant',
          content:
            'Welcome to Our Global Memory Vault. Type anything to remember it permanently, or ask a question to retrieve existing memories from our shared vault.',
          created_at: new Date().toISOString(),
        },
      ]);
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

      // Upload attachment to private memory-files bucket and record in attachments table
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
            public_url: null, // Keep bucket private
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

      // ONLY reset input and attachment AFTER complete success
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
      const usefulError = err instanceof Error ? err.message : 'Sorry, an error occurred while processing your request. Please try again.';
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

    const defaultMsg: ChatMessage[] = [
      {
        id: 'welcome-' + Date.now(),
        conversation_id: 'default',
        space_id: spaceId || '',
        sender_type: 'assistant',
        content:
          'New chat initialized. Type anything to remember it permanently in our shared vault, or ask a question to retrieve memories.',
        created_at: new Date().toISOString(),
      },
    ];
    setMessages(defaultMsg);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleDeleteCurrentChat = async () => {
    if (activeConversationId) {
      try {
        await fetch('/api/conversations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: activeConversationId }),
        });
      } catch (err) {
        console.warn('Delete chat error:', err);
      }
    }
    handleNewChat();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#14161B] border border-[#222630] rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Chat Header */}
      <div className="px-6 py-3 border-b border-[#222630] bg-[#0B0C0E] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#C6FF00]/10 border border-[#C6FF00]/20 flex items-center justify-center text-[#C6FF00]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-tight">Conversational Memory Vault</h2>
            <p className="text-[10px] text-slate-400">Type to save or ask questions about stored memories</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {fetchingHistory && (
            <span className="text-[10px] text-[#C6FF00] flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Fetching Supabase History...</span>
            </span>
          )}

          {activeConversationId && (
            <button
              onClick={handleDeleteCurrentChat}
              title="Delete Chat (Does NOT delete memories)"
              className="p-1.5 rounded-lg bg-[#14161B] hover:bg-rose-500/10 border border-[#222630] text-slate-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleNewChat}
            className="text-[10px] text-[#C6FF00] hover:text-[#b8ee00] px-3 py-1.5 rounded-xl bg-[#C6FF00]/10 border border-[#C6FF00]/30 font-semibold transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-4 custom-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.sender_type === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-[#0B0C0E] border border-[#222630] flex items-center justify-center text-[#C6FF00] shrink-0 mt-0.5 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-xl space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Message Content Bubble */}
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#C6FF00] text-black font-medium rounded-tr-none shadow-md shadow-[#C6FF00]/10'
                      : 'bg-[#0B0C0E] border border-[#222630] text-slate-200 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Inline Saved Memory Confirmation Card */}
                {msg.metadata?.is_saved_confirmation && msg.metadata.saved_memory && (
                  <div
                    onClick={() => onSelectMemory(msg.metadata!.saved_memory!)}
                    className="p-4 rounded-xl bg-[#0B0C0E] border border-[#C6FF00]/40 hover:border-[#C6FF00] transition-colors cursor-pointer space-y-2 shadow-lg w-full"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#C6FF00] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Memory Saved to Global Vault</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Click to open</span>
                    </div>

                    <p className="text-xs text-slate-200 font-semibold">
                      {msg.metadata.saved_memory.title || msg.metadata.saved_memory.content}
                    </p>

                    {msg.metadata.saved_memory.tags && msg.metadata.saved_memory.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {msg.metadata.saved_memory.tags.map((t) => (
                          <span
                            key={t.name}
                            className="px-2 py-0.5 rounded-md bg-[#14161B] border border-[#222630] text-[10px] font-mono text-slate-400"
                          >
                            #{t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Clickable Source References */}
                {msg.metadata?.cited_sources && msg.metadata.cited_sources.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#0B0C0E] border border-[#222630] space-y-2 w-full">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1 text-[#C6FF00]">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Original Evidence ({msg.metadata.cited_sources.length})</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.metadata.cited_sources.map((src) => (
                        <button
                          key={src.id}
                          onClick={() => onSelectMemory(src)}
                          className="p-2.5 rounded-xl bg-[#14161B] border border-[#222630] hover:border-[#C6FF00]/40 text-left flex items-start justify-between gap-2 group transition-colors"
                        >
                          <div className="truncate">
                            <span className="text-[10px] text-slate-400 font-semibold block">
                              {src.author?.full_name || 'Member'} • {new Date(src.created_at).toLocaleDateString()}
                            </span>
                            <p className="text-xs text-slate-200 truncate">{src.title || src.content}</p>
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#C6FF00] shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#C6FF00] font-medium p-2">
            <span className="animate-spin">⌛</span>
            <span>Processing intent & updating memory vault...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Persistent Bottom Chat Composer */}
      <div className="p-3 bg-[#0B0C0E] border-t border-[#222630] space-y-2">
        {attachment && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#14161B] border border-[#222630] text-xs text-slate-300">
            <span className="truncate">Attached: {attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-slate-500 hover:text-white text-xs">
              Remove
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={onOpenAddModal}
            title="Explicit Memory Creation Modal"
            className="p-2.5 rounded-xl bg-[#14161B] hover:bg-[#1c202a] border border-[#222630] hover:border-[#C6FF00]/40 text-[#C6FF00] transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>

          <label
            title="Attach file to message"
            className="p-2.5 rounded-xl bg-[#14161B] hover:bg-[#1c202a] border border-[#222630] hover:border-[#C6FF00]/40 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
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
            className="flex-1 bg-[#14161B] border border-[#222630] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C6FF00]/50 transition-colors"
          />

          <button
            type="submit"
            disabled={loading || (!input.trim() && !attachment)}
            className="bg-[#C6FF00] hover:bg-[#b8ee00] text-black font-semibold rounded-xl px-4 py-2.5 text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-[#C6FF00]/10 disabled:opacity-30 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
