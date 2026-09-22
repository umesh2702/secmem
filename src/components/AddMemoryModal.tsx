'use client';

import { useState } from 'react';
import { X, Type, Image as ImageIcon, Link as LinkIcon, Paperclip, Plus, Sparkles, Hash } from 'lucide-react';
import { MemoryType } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface AddMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string | null;
  userId: string | null;
  onMemoryCreated: () => void;
}

export default function AddMemoryModal({
  isOpen,
  onClose,
  spaceId,
  userId,
  onMemoryCreated,
}: AddMemoryModalProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<MemoryType>('TEXT');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && activeTab === 'TEXT') return;
    if (!url.trim() && activeTab === 'LINK') return;
    if (files.length === 0 && (activeTab === 'IMAGE' || activeTab === 'FILE')) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      let finalContent = content.trim();
      const metadata: Record<string, any> = {};

      if (activeTab === 'LINK') {
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = 'https://' + cleanUrl;
        }
        metadata.url = cleanUrl;
        try {
          const parsed = new URL(cleanUrl);
          metadata.domain = parsed.hostname;
        } catch {
          // ignore parsing
        }
        if (!finalContent) {
          finalContent = `Saved link: ${cleanUrl}`;
        }
      }

      if (!finalContent && (activeTab === 'IMAGE' || activeTab === 'FILE')) {
        finalContent = files.map((f) => f.name).join(', ');
      }

      // Check for real auth user
      const { data: { user } } = await supabase.auth.getUser();

      const isValidUuid = (str?: string | null) =>
        str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      let targetSpaceId = isValidUuid(spaceId) ? spaceId! : null;
      if (!targetSpaceId) {
        const { data: spRows } = await supabase.from('spaces').select('id').limit(1).single();
        if (spRows) targetSpaceId = spRows.id;
      }

      const targetUserId = user ? user.id : 'e05dcda3-09e1-4afd-a62c-3ceb30c5f09c';

      if (targetSpaceId && targetUserId) {
        // Insert into real Supabase DB
        const { data: memory, error: memoryErr } = await supabase
          .from('memories')
          .insert({
            space_id: targetSpaceId,
            created_by: targetUserId,
            title: title.trim() || null,
            content: finalContent,
            type: activeTab,
            metadata,
          })
          .select()
          .single();

        if (memoryErr) {
          throw new Error(memoryErr.message || memoryErr.details || 'Failed to insert memory into Supabase');
        }

        // Process tag names
        if (tagInput.trim()) {
          const tagNames = tagInput.trim().split(/\s+/).map(t => t.replace('#', ''));
          for (const tagName of tagNames) {
            const { data: existingTag } = await supabase
              .from('tags')
              .select('id')
              .eq('space_id', targetSpaceId)
              .eq('name', tagName)
              .single();

            let tagId = existingTag?.id;

            if (!tagId) {
              const { data: newTag } = await supabase
                .from('tags')
                .insert({ space_id: targetSpaceId, name: tagName })
                .select()
                .single();
              tagId = newTag?.id;
            }

            if (tagId) {
              await supabase
                .from('memory_tags')
                .insert({ memory_id: memory.id, tag_id: tagId });
            }
          }
        }

        // Upload attachments
        if (files.length > 0 && memory) {
          for (const file of files) {
            const filePath = `${targetSpaceId}/${memory.id}/${Date.now()}_${file.name}`;
            const { error: uploadErr } = await supabase.storage
              .from('memory-files')
              .upload(filePath, file);

            if (!uploadErr) {
              const { data: publicUrlData } = supabase.storage
                .from('memory-files')
                .getPublicUrl(filePath);

              await supabase.from('attachments').insert({
                memory_id: memory.id,
                file_name: file.name,
                file_path: filePath,
                file_type: file.type || 'application/octet-stream',
                file_size: file.size,
                public_url: publicUrlData?.publicUrl || null,
              });
            }
          }
        }
      }

      // Reset form
      setTitle('');
      setContent('');
      setUrl('');
      setTagInput('');
      setFiles([]);
      onMemoryCreated();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create memory:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error creating memory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161B] border border-[#222630] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222630]">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Plus className="w-5 h-5 text-[#C6FF00]" />
            <span>Add Memory</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#222630] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-4 gap-1 p-3 bg-[#0B0C0E] border-b border-[#222630]">
          {[
            { type: 'TEXT' as MemoryType, label: 'Text', icon: Type },
            { type: 'IMAGE' as MemoryType, label: 'Image', icon: ImageIcon },
            { type: 'LINK' as MemoryType, label: 'Link', icon: LinkIcon },
            { type: 'FILE' as MemoryType, label: 'File', icon: Paperclip },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.type;
            return (
              <button
                key={tab.type}
                type="button"
                onClick={() => setActiveTab(tab.type)}
                className={`py-2 px-1 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-[#14161B] text-[#C6FF00] border border-[#222630] shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Title Optional */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Title <span className="text-slate-600">(Optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this memory a name..."
              className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#C6FF00]/50"
            />
          </div>

          {/* Type specific input */}
          {activeTab === 'TEXT' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Memory Content <span className="text-[#C6FF00]">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note, idea, memory, or summary here..."
                className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#C6FF00]/50 resize-none"
              />
            </div>
          )}

          {activeTab === 'LINK' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  URL <span className="text-[#C6FF00]">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#C6FF00]/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Notes / Commentary
                </label>
                <textarea
                  rows={2}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Why did you save this link?..."
                  className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#C6FF00]/50 resize-none"
                />
              </div>
            </div>
          )}

          {(activeTab === 'IMAGE' || activeTab === 'FILE') && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Select {activeTab === 'IMAGE' ? 'Images' : 'Files'} <span className="text-[#C6FF00]">*</span>
                </label>
                <input
                  type="file"
                  multiple={activeTab === 'IMAGE'}
                  accept={activeTab === 'IMAGE' ? 'image/*' : '*'}
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1c202a] file:text-[#C6FF00] hover:file:bg-[#252b38] file:cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Memory Description
                </label>
                <textarea
                  rows={2}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Add notes or description for these attachments..."
                  className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#C6FF00]/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Tags <span className="text-slate-600">(Separated by spaces)</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="ideas business product ulink"
                className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#C6FF00]/50"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-[#222630] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#222630] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#C6FF00] hover:bg-[#b8ee00] text-black font-semibold rounded-xl px-5 py-2 text-xs transition-colors shadow-md shadow-[#C6FF00]/10 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <span>Saving memory...</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save Memory</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
