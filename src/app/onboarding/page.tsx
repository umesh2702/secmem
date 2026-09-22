'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14161B] border border-[#222630] text-[#C6FF00] text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Our Memory Vault</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Entering Shared Vault...</h1>
        <p className="text-slate-400 text-xs">Redirecting to the global shared memory vault.</p>
      </div>
    </div>
  );
}
