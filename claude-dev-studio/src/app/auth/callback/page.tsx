'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && supabase) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.replace('/');
      });
    } else {
      router.replace('/');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400 text-sm">ログイン処理中...</p>
    </div>
  );
}
