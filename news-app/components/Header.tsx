export function Header() {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-xl">📡</span>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">
            NewsFlow
          </h1>
        </div>
        <span className="text-xs text-gray-400 bg-purple-50 text-purple-600 px-2 py-1 rounded-full font-medium">
          ⚡ 技術優先
        </span>
      </div>
    </header>
  );
}
