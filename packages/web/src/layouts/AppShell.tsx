import { ComponentType, ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Users,
  Building2,
  FileText,
  Database,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { useUnreadCount } from '@/features/tickets/api';
import { Button } from '@/components/ui/button';
import { VaultBanner } from '@/components/VaultBanner';
import { ROLE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  badge?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, badge: true },
  { to: '/tickets/new', label: 'Novo chamado', icon: Plus },
  { to: '/admin/users', label: 'Usuários', icon: Users, adminOnly: true },
  { to: '/admin/departments', label: 'Departamentos', icon: Building2, adminOnly: true },
  { to: '/admin/reports', label: 'Relatórios', icon: FileText, adminOnly: true },
  { to: '/admin/backup', label: 'Backup', icon: Database, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === '1',
  );
  const location = useLocation();
  const { data: unread } = useUnreadCount();
  const items = NAV.filter((i) => !i.adminOnly || user?.role === 'ADMIN');

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
      return !c;
    });
  }

  function sidebar(showCollapseBtn: boolean) {
    return (
      <nav className="flex h-full flex-col gap-1 bg-grena-gradient p-3 text-white">
        <div className={cn('mb-6 flex items-center', collapsed ? 'justify-center' : 'justify-between', 'px-1')}>
          {collapsed ? (
            <img
              src="/logo-juventus.png"
              alt="Clube Atlético Juventus"
              className="h-9 w-9 rounded-full bg-white/90 object-contain p-0.5"
            />
          ) : (
            <div className="flex items-center gap-3">
              <img
                src="/logo-juventus.png"
                alt="Clube Atlético Juventus"
                className="h-11 w-11 shrink-0 rounded-full bg-white/90 object-contain p-0.5"
              />
              <div>
                <h1 className="text-sm font-bold leading-tight">Chamados</h1>
                <p className="text-[11px] leading-tight text-white/70">Clube Atlético Juventus</p>
                {user && (
                  <p className="mt-1 text-xs text-white/70">
                    {user.name} · {ROLE_LABEL[user.role]}
                  </p>
                )}
              </div>
            </div>
          )}
          {showCollapseBtn && (
            <button
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              onClick={toggleCollapsed}
              className="hidden rounded-md p-2 text-white/80 hover:bg-white/10 md:block"
            >
              {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          )}
        </div>

        {items.map((i) => {
          const active = location.pathname === i.to;
          const showBadge = i.badge && (unread?.count ?? 0) > 0;
          const Icon = i.icon;
          return (
            <Link
              key={i.to}
              to={i.to}
              onClick={() => setOpen(false)}
              title={collapsed ? i.label : undefined}
              className={cn(
                'flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                collapsed && 'justify-center px-2',
                active ? 'bg-white/15' : 'text-white/85 hover:bg-white/10',
              )}
            >
              <span className="relative leading-none">
                <Icon className="h-5 w-5" />
                {showBadge && collapsed && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-grena">
                    {unread!.count}
                  </span>
                )}
              </span>
              {!collapsed && <span>{i.label}</span>}
              {!collapsed && showBadge && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-grena">
                  {unread!.count}
                </span>
              )}
            </Link>
          );
        })}

        <div className="mt-auto space-y-1 border-t border-white/15 pt-2">
          <Link
            to="/change-password"
            onClick={() => setOpen(false)}
            title="Configurações (trocar senha)"
            className={cn(
              'flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium transition',
              collapsed ? 'justify-center px-2' : 'justify-start gap-2',
              location.pathname === '/change-password'
                ? 'bg-white/15 text-white'
                : 'text-white/85 hover:bg-white/10',
            )}
          >
            <Settings className="h-5 w-5" />
            {!collapsed && <span>Configurações</span>}
          </Link>
          <Button
            variant="ghost"
            className={cn('w-full text-white hover:bg-white/10', collapsed ? 'justify-center px-2' : 'justify-start')}
            onClick={logout}
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-grena/10 bg-grena-gradient px-4 py-3 text-white md:hidden print:hidden">
        <button aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <Menu className="h-6 w-6" />
        </button>
        <span className="flex items-center gap-2 font-bold">
          <img
            src="/logo-juventus.png"
            alt="Clube Atlético Juventus"
            className="h-7 w-7 rounded-full bg-white/90 object-contain p-0.5"
          />
          Chamados
        </span>
        <span className="relative w-6 text-right">
          {(unread?.count ?? 0) > 0 && (
            <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-grena">
              {unread!.count}
            </span>
          )}
        </span>
      </header>

      <div className="md:flex">
        <aside
          className={cn(
            'hidden shrink-0 md:sticky md:top-0 md:block md:h-screen print:hidden',
            collapsed ? 'md:w-16' : 'md:w-64',
          )}
        >
          {sidebar(true)}
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 shadow-xl">{sidebar(false)}</aside>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8">
          {user && <VaultBanner isAdmin={user.role === 'ADMIN'} />}
          {children}
        </main>
      </div>
    </div>
  );
}
