'use client';

import { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Copy, Check, Download, ExternalLink, Calendar, User, Tag as TagIcon, Save, Paperclip } from 'lucide-react';
import { Memory, Attachment } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

function MemoryAttachmentItem({ att, memoryType }: { att: Attachment; memoryType: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(att.public_url || null);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;
    if (att.file_path) {
      supabase.storage
        .from('memory-files')
        .createSignedUrl(att.file_path, 3600)
        .then(({ data }) => {
          if (isMounted && data?.signedUrl) {
            setSignedUrl(data.signedUrl);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [att.file_path, att.public_url]);

  const isImg = att.file_type?.startsWith('image/') || memoryType === 'IMAGE';
  const downloadUrl = signedUrl || undefined;

  if (isImg && signedUrl) {
    return (
      <div className="rounded-xl bg-[#0A0D14] border border-[#1E2536] overflow-hidden">
        <img src={signedUrl} alt={att.file_name} className="w-full max-h-60 object-contain" />
        <div className="p-2 flex items-center justify-between bg-[#121620] text-[10px] text-slate-400">
          <span className="truncate">{att.file_name}</span>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download className="hover:text-white">
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-[#0A0D14] border border-[#1E2536] flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 truncate">
        <Paperclip className="w-3.5 h-3.5 text-[#C6FF00] shrink-0" />
        <span className="truncate text-slate-200">{att.file_name}</span>
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="p-1 rounded bg-[#182030] text-[#C6FF00] hover:bg-[#202B40] shrink-0"
        >
          <Download className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

interface MemoryDetailModalProps {
  memory: Memory | null;
  onClose: () => void;
  onMemoryUpdated: () => void;
  onMemoryDeleted: () => void;
}

export default function MemoryDetailModal({
  memory,
  onClose,
  onMemoryUpdated,
  onMemoryDeleted,
}: MemoryDetailModalProps) {
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (memory) {
      setTitle(memory.title || '');
      setContent(memory.content || '');
      setTagsStr(memory.tags?.map((t) => t.name).join(' ') || '');
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [memory]);

  // Handle Escape key press to close modal
  useEffect(() => {
    if (!memory) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [memory, onClose]);

  if (!memory) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(memory.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await supabase
        .from('memories')
        .update({
          title: title.trim() || null,
          content: content.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', memory.id);

      setIsEditing(false);
      onMemoryUpdated();
    } catch (err) {
      console.error('Failed to update memory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await supabase.from('memories').delete().eq('id', memory.id);
      onMemoryDeleted();
      onClose();
    } catch (err) {
      console.error('Failed to delete memory:', err);
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = new Date(memory.created_at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0F131C] border border-[#1E2536] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2536] bg-[#0A0D14]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#182030] border border-[#2B354C] flex items-center justify-center text-[10px] font-bold text-[#C6FF00]">
              {(memory.author?.full_name || 'Member').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{memory.author?.full_name || 'Member'}</p>
              <p className="text-[10px] text-slate-400 font-mono">{formattedDate}</p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              title="Copy Content"
              className="p-2 rounded-xl bg-[#121620] border border-[#1E2536] hover:border-[#C6FF00]/40 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-[#C6FF00]" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              title="Edit Memory"
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isEditing
                  ? 'bg-[#1A2608] border-[#C6FF00] text-[#C6FF00]'
                  : 'bg-[#121620] border-[#1E2536] text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete Memory"
              className="p-2 rounded-xl bg-[#121620] hover:bg-rose-500/10 border border-[#1E2536] hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 rounded-xl bg-[#121620] border border-[#1E2536] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          {/* Delete Confirmation Alert */}
          {showDeleteConfirm && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-3">
              <p className="font-semibold">Are you sure you want to permanently delete this memory?</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors cursor-pointer"
                >
                  {loading ? 'Deleting...' : 'Yes, Delete Permanently'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#121620] border border-[#1E2536] text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isEditing ? (
            /* Editing View */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0A0D14] border border-[#1E2536] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#C6FF00]/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Content</label>
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-[#0A0D14] border border-[#1E2536] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#C6FF00]/50 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="bg-[#C6FF00] hover:bg-[#b5f800] text-black font-semibold rounded-xl px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          ) : (
            /* Display View */
            <div className="space-y-4">
              {memory.title && (
                <h2 className="text-xl font-bold text-white leading-tight">{memory.title}</h2>
              )}

              {/* Memory Content */}
              <div className="bg-[#0A0D14] p-4 rounded-xl border border-[#1E2536]">
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {memory.content}
                </p>
              </div>

              {/* Link metadata view */}
              {memory.type === 'LINK' && memory.metadata?.url && (
                <div className="p-4 rounded-xl bg-[#0A0D14] border border-[#1E2536] flex items-center justify-between gap-4">
                  <div className="truncate">
                    <p className="text-xs text-slate-400 font-mono truncate">{memory.metadata.url}</p>
                  </div>
                  <a
                    href={memory.metadata.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#C6FF00] text-black font-semibold text-xs flex items-center gap-1 shrink-0"
                  >
                    <span>Visit Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Attachments Gallery */}
              {memory.attachments && memory.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400">Attachments & Files</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {memory.attachments.map((att) => (
                      <MemoryAttachmentItem key={att.id} att={att} memoryType={memory.type} />
                    ))}
                  </div>
                </div>
              )}

              {/* Tags list */}
              {memory.tags && memory.tags.length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <TagIcon className="w-3.5 h-3.5 text-slate-500" />
                  <div className="flex flex-wrap gap-1.5">
                    {memory.tags.map((t) => (
                      <span
                        key={t.id || t.name}
                        className="px-2.5 py-1 rounded-lg bg-[#0A0D14] border border-[#1E2536] text-xs font-mono text-slate-300"
                      >
                        #{t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

