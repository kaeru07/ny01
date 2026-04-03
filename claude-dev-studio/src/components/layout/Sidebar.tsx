'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/projects', label: '案件管理', icon: FolderKanban },
  { href: '/prompts', label: 'プロンプト', icon: FileText },
  { href: '/settings', label: '設定', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-gray-950 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-gray-800">
        <div className="flex flex-col gap-0.5">
          <span className="text-white font-bold text-sm">AICOMPANY</span>
          <span className="text-gray-500 text-xs">案件司令塔</span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-800">
        <span className="text-xs text-gray-600">Studio v2.0</span>
      </div>
    </aside>
  );
}
