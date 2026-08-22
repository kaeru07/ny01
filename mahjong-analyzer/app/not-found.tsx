import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-safe-area mx-auto flex min-h-screen max-w-2xl items-center px-4">
      <section className="w-full rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-4xl" aria-hidden="true">
          🀄
        </p>
        <h1 className="mt-3 text-xl font-bold text-gray-800">
          ページが見つかりません
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          URLをご確認いただくか、手牌解析画面へ戻ってください。
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:bg-blue-800"
        >
          手牌解析へ戻る
        </Link>
      </section>
    </main>
  );
}
