'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Users, PlusCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [spaceName, setSpaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'MEM-';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Fallback for demo mode
        router.push('/');
        return;
      }

      if (mode === 'CREATE') {
        const code = generateInviteCode();
        // 1. Insert space
        const { data: space, error: spaceErr } = await supabase
          .from('spaces')
          .insert({
            name: spaceName.trim() || 'Our Shared Vault',
            invite_code: code,
            created_by: user.id,
          })
          .select()
          .single();

        if (spaceErr) throw spaceErr;

        // 2. Insert space_member
        const { error: memberErr } = await supabase.from('space_members').insert({
          space_id: space.id,
          user_id: user.id,
          role: 'owner',
        });

        if (memberErr) throw memberErr;
      } else {
        // JOIN space
        const cleanCode = inviteCode.trim().toUpperCase();
        const { data: space, error: findErr } = await supabase
          .from('spaces')
          .select('id')
          .eq('invite_code', cleanCode)
          .single();

        if (findErr || !space) {
          throw new Error('Invalid invite code. Please check with your partner.');
        }

        const { error: joinErr } = await supabase.from('space_members').insert({
          space_id: space.id,
          user_id: user.id,
          role: 'member',
        });

        if (joinErr && !joinErr.message.includes('duplicate')) {
          throw joinErr;
        }
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#C6FF00]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14161B] border border-[#222630] text-[#C6FF00] text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to Our Memory</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Set up your shared memory space
          </h1>
          <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
            A private vault designed for two. Create a new memory space or join your partner using an invite code.
          </p>
        </div>

        <div className="bg-[#14161B] border border-[#222630] rounded-2xl p-6 shadow-2xl">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setMode('CREATE')}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                mode === 'CREATE'
                  ? 'bg-[#1c202a] border-[#C6FF00] text-white shadow-sm'
                  : 'bg-[#0B0C0E] border-[#222630] text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className={`w-4 h-4 ${mode === 'CREATE' ? 'text-[#C6FF00]' : 'text-slate-500'}`} />
              <span className="text-xs font-semibold">Create New Space</span>
              <span className="text-[10px] text-slate-500">Start a new shared vault</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('JOIN')}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                mode === 'JOIN'
                  ? 'bg-[#1c202a] border-[#C6FF00] text-white shadow-sm'
                  : 'bg-[#0B0C0E] border-[#222630] text-slate-400 hover:text-white'
              }`}
            >
              <Users className={`w-4 h-4 ${mode === 'JOIN' ? 'text-[#C6FF00]' : 'text-slate-500'}`} />
              <span className="text-xs font-semibold">Join Existing Space</span>
              <span className="text-[10px] text-slate-500">Use partner's invite code</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleAction} className="space-y-4">
            {mode === 'CREATE' ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Vault Name
                </label>
                <input
                  type="text"
                  required
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  placeholder="e.g. Umesh & Friend's Memories"
                  className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#C6FF00]/50"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Invite Code
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="e.g. MEM-8X92"
                  className="w-full bg-[#0B0C0E] border border-[#222630] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#C6FF00]/50 uppercase tracking-widest font-mono"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C6FF00] hover:bg-[#b8ee00] text-black font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#C6FF00]/10 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Setting up...</span>
              ) : (
                <>
                  <span>{mode === 'CREATE' ? 'Initialize Space' : 'Join Memory Space'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
