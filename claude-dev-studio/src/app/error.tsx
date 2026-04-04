'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError] runtime error caught by error boundary:', error);
    console.error('[AppError] message:', error.message);
    console.error('[AppError] stack:', error.stack);
  }, [error]);

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-red-400 text-base font-semibold">ページの読み込みに失敗しました</h2>
      <p className="text-gray-400 text-sm">{error.message}</p>
      {error.digest && (
        <p className="text-gray-600 text-xs font-mono">digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="text-sm text-blue-400 hover:underline"
      >
        再読み込み
      </button>
    </div>
  );
}
