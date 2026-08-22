"use client";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="app-safe-area mx-auto flex min-h-screen max-w-2xl items-center px-4">
      <section
        role="alert"
        className="w-full rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <p className="text-4xl" aria-hidden="true">
          🀄
        </p>
        <h1 className="mt-3 text-xl font-bold text-gray-800">
          画面を表示できませんでした
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          一時的な問題が発生しました。入力内容は端末の外部へ送信されていません。
          もう一度お試しください。
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 min-h-11 rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:bg-blue-800"
        >
          もう一度試す
        </button>
      </section>
    </main>
  );
}
