'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError] fatal error caught:', error);
    console.error('[GlobalError] message:', error.message);
    console.error('[GlobalError] stack:', error.stack);
  }, [error]);

  return (
    <html lang="ja">
      <body className="bg-gray-900 text-gray-100 p-6 space-y-4">
        <h2 className="text-red-400 text-base font-semibold">アプリの読み込みに失敗しました</h2>
        <p className="text-gray-400 text-sm">{error.message}</p>
        <button
          onClick={reset}
          className="text-sm text-blue-400 hover:underline"
        >
          再試行
        </button>
      </body>
    </html>
  );
}
