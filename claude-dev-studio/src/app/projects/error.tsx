'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[ProjectsError] runtime error caught:', error);
    console.error('[ProjectsError] message:', error.message);
    console.error('[ProjectsError] stack:', error.stack);
  }, [error]);

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-red-400 text-base font-semibold">案件ページの読み込みに失敗しました</h2>
      <p className="text-gray-400 text-sm">{error.message}</p>
      {error.digest && (
        <p className="text-gray-600 text-xs font-mono">digest: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button onClick={reset} className="text-sm text-blue-400 hover:underline">
          再読み込み
        </button>
        <button onClick={() => router.push('/projects')} className="text-sm text-gray-400 hover:underline">
          一覧へ戻る
        </button>
      </div>
    </div>
  );
}
