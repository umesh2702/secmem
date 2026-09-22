'use client';

import { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon, Link as LinkIcon, Paperclip, ExternalLink, Download, Hash, Clock } from 'lucide-react';
import { Memory, Attachment } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

function CardAttachmentItem({ att, memoryType }: { att: Attachment; memoryType: string }) {
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

  if (isImg && signedUrl) {
    return (
      <div className="relative w-24 h-24 rounded-xl bg-[#0B0C0E] border border-[#222630] overflow-hidden shrink-0">
        <img src={signedUrl} alt={att.file_name} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5 rounded-xl bg-[#0B0C0E] border border-[#222630] flex items-center gap-2 text-xs text-slate-300">
      <Paperclip className="w-3.5 h-3.5 text-purple-400 shrink-0" />
      <span className="truncate max-w-[150px]">{att.file_name}</span>
      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          onClick={(e) => e.stopPropagation()}
          className="p-1 text-slate-500 hover:text-white"
        >
          <Download className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

interface MemoryCardProps {
  memory: Memory;
  onSelect: (m: Memory) => void;
  onSelectTag?: (tagName: string) => void;
}

export default function MemoryCard({ memory, onSelect, onSelectTag }: MemoryCardProps) {
  const getTypeBadge = () => {
    switch (memory.type) {
      case 'IMAGE':
        return { label: 'Image', icon: ImageIcon, color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' };
      case 'LINK':
        return { label: 'Link', icon: LinkIcon, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
      case 'FILE':
        return { label: 'File', icon: Paperclip, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
      default:
        return { label: 'Note', icon: FileText, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
    }
  };

  const badge = getTypeBadge();
  const Icon = badge.icon;

  const formattedTime = new Date(memory.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const authorName = memory.author?.full_name || 'Member';

  return (
    <div
      onClick={() => onSelect(memory)}
      className="group bg-[#14161B] hover:bg-[#181a20] border border-[#222630] hover:border-[#C6FF00]/30 rounded-2xl p-5 transition-all cursor-pointer shadow-md flex flex-col gap-3 relative"
    >
      {/* Top Meta Bar: Author, Time, Type Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Author avatar */}
          <div className="w-6 h-6 rounded-full bg-[#1c202a] border border-[#222630] flex items-center justify-center text-[9px] font-extrabold text-[#C6FF00] overflow-hidden">
            {memory.author?.avatar_url ? (
              <img src={memory.author.avatar_url} alt="Author" className="w-full h-full object-cover" />
            ) : (
              authorName.slice(0, 2).toUpperCase()
            )}
          </div>
          <span className="text-xs font-semibold text-slate-300">{authorName}</span>
          <span className="text-slate-600 text-xs">•</span>
          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-600" />
            <span>{formattedTime}</span>
          </span>
        </div>

        {/* Type Badge */}
        <div className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 ${badge.color}`}>
          <Icon className="w-3 h-3" />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Memory Title (Optional) */}
      {memory.title && (
        <h3 className="text-sm font-bold text-white group-hover:text-[#C6FF00] transition-colors leading-snug">
          {memory.title}
        </h3>
      )}

      {/* Raw Original Content */}
      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
        {memory.content}
      </p>

      {/* Link Card Attachment */}
      {memory.type === 'LINK' && memory.metadata?.url && (
        <a
          href={memory.metadata.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-3 rounded-xl bg-[#0B0C0E] border border-[#222630] hover:border-[#C6FF00]/40 flex items-center justify-between gap-3 text-xs transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <LinkIcon className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-300 truncate font-mono">{memory.metadata.url}</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        </a>
      )}

      {/* Attachments (Images / Files) */}
      {memory.attachments && memory.attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {memory.attachments.map((att) => (
            <CardAttachmentItem key={att.id} att={att} memoryType={memory.type} />
          ))}
        </div>
      )}

      {/* Memory Tags */}
      {memory.tags && memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {memory.tags.map((tag) => (
            <button
              key={tag.id || tag.name}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectTag) onSelectTag(tag.name);
              }}
              className="px-2 py-0.5 rounded-md bg-[#0B0C0E] border border-[#222630] hover:border-[#C6FF00]/40 text-[10px] text-slate-400 hover:text-[#C6FF00] font-mono flex items-center gap-0.5 transition-colors"
            >
              <Hash className="w-2.5 h-2.5 text-slate-500" />
              <span>{tag.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
