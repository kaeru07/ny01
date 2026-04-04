'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Settings, FileText, X, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/projects', label: '案件管理', icon: FolderKanban },
  { href: '/prompts', label: 'プロンプト', icon: FileText },
  { href: '/settings', label: '設定', icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <aside
      className={cn(
        'w-56 shrink-0 bg-gray-950 flex flex-col',
        // Desktop: sticky in flex layout
        'sm:sticky sm:top-0 sm:h-screen',
        // Mobile: fixed drawer, slides in/out
        'max-sm:fixed max-sm:inset-y-0 max-sm:left-0 max-sm:z-30 max-sm:h-full max-sm:transition-transform max-sm:duration-200',
        open ? 'max-sm:translate-x-0' : 'max-sm:-translate-x-full'
      )}
    >
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-white font-bold text-sm">AICOMPANY</span>
          <span className="text-gray-500 text-xs">案件司令塔</span>
        </div>
        <button
          onClick={onClose}
          className="sm:hidden text-gray-500 hover:text-white p-0.5"
        >
          <X className="w-4 h-4" />
        </button>
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
              onClick={onClose}
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
      <div className="p-3 border-t border-gray-800 space-y-2">
        {isSupabaseConfigured && user && (
          <>
            <p className="text-[11px] text-gray-600 truncate px-1">{user.email}</p>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              ログアウト
            </button>
          </>
        )}
        <span className="text-xs text-gray-700 block px-1">Studio v2.0</span>
      </div>
    </aside>
  );
}
