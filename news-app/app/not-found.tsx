import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <p className="text-6xl mb-4">📭</p>
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        ページが見つかりません
      </h2>
      <p className="text-sm text-gray-500 mb-6 text-center">
        ニュースが削除されたか、URLが間違っている可能性があります。
      </p>
      <Link
        href="/"
        className="bg-gray-900 text-white text-sm font-semibold px-6 py-3 rounded-xl"
      >
        ホームに戻る
      </Link>
    </div>
  );
}
