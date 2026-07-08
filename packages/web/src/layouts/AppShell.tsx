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
  ExternalLink,
  MonitorSmartphone,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { useUnreadCount } from '@/features/tickets/api';
import { Button } from '@/components/ui/button';
import { TipsToaster } from '@/components/TipsToaster';
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
  { to: '/admin/totem', label: 'Totem', icon: MonitorSmartphone, adminOnly: true },
];


const EASY_LIFE_URL = 'http://192.42.0.102/';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === '1',
  );
  const location = useLocation();
  const { data: unread } = useUnreadCount();
  const items = NAV.filter((i) => {
    // Itens administrativos: só ADMIN.
    if (i.adminOnly) return user?.role === 'ADMIN';
    // "Novo chamado": OPERATOR não abre chamados (só atende).
    if (i.to === '/tickets/new') return user?.role !== 'OPERATOR';
    return true;
  });

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
      return !c;
    });
  }

  function sidebar(showCollapseBtn: boolean) {
    return (
      <nav className="flex flex-col h-full gap-1 p-3 text-white bg-grena-gradient">
        <div className={cn('mb-6 flex px-1', collapsed ? 'flex-col items-center gap-2' : 'items-center justify-between')}>
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
                <h1 className="text-sm font-bold leading-tight">Service Desk</h1>
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
              className="hidden p-2 rounded-md text-white/80 hover:bg-white/10 md:block"
            >
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
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
                <Icon className="w-5 h-5" />
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

        <div className="pt-2 mt-auto space-y-1 border-t border-white/15">
          <a
            href={EASY_LIFE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="EASY LIFE"
            className={cn(
              'flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10',
              collapsed ? 'justify-center px-2' : 'justify-start gap-2',
            )}
          >
            <ExternalLink className="w-5 h-5" />
            {!collapsed && <span>EASY LIFE</span>}
          </a>
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
            <Settings className="w-5 h-5" />
            {!collapsed && <span>Configurações</span>}
          </Link>
          <Button
            variant="ghost"
            className={cn('w-full text-white hover:bg-white/10', collapsed ? 'justify-center px-2' : 'justify-start')}
            onClick={logout}
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between px-4 py-3 text-white border-b border-grena/10 bg-grena-gradient md:hidden print:hidden">
        <button aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <Menu className="w-6 h-6" />
        </button>
        <span className="flex items-center gap-2 font-bold">
          <img
            src="/logo-juventus.png"
            alt="Clube Atlético Juventus"
            className="h-7 w-7 rounded-full bg-white/90 object-contain p-0.5"
          />
          Service Desk
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
            'hidden shrink-0 overflow-hidden md:sticky md:top-0 md:block md:h-screen print:hidden',
            'transition-[width] duration-300 ease-in-out',
            collapsed ? 'md:w-16' : 'md:w-64',
          )}
        >
          {sidebar(true)}
        </aside>

        <div className={cn('fixed inset-0 z-40 md:hidden', !open && 'pointer-events-none')}>
          <div
            className={cn(
              'absolute inset-0 bg-black/40 transition-opacity duration-300',
              open ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setOpen(false)}
          />
          <aside
            className={cn(
              'absolute left-0 top-0 h-full w-64 shadow-xl transition-transform duration-300 ease-in-out',
              open ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            {sidebar(false)}
          </aside>
        </div>

        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>

      {user?.role === 'USER' && <TipsToaster />}
    </div>
  );
}
