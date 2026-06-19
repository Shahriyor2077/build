import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, Users, Building2, Target, MapPin, Boxes,
  FileSignature, ReceiptText, FileText, BarChart3, Settings, Search, Bell,
  LogOut, ChevronLeft, Menu, Palette, Check,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../store/auth';
import { api } from '../api/client';
import { useTheme, THEMES } from '../store/theme';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm?: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone, perm: 'campaigns.read' },
  { to: '/leads', label: 'Leads', icon: Target, perm: 'leads.read' },
  { to: '/accounts', label: 'Accounts', icon: Users, perm: 'accounts.read' },
  { to: '/opportunities', label: 'Opportunities', icon: Building2, perm: 'opportunities.read' },
  { to: '/site-visits', label: 'Site Visits', icon: MapPin, perm: 'siteVisits.read' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, perm: 'inventory.read' },
  { to: '/bookings', label: 'Bookings', icon: FileSignature, perm: 'bookings.read' },
  { to: '/finance', label: 'Demand & Receipts', icon: ReceiptText, perm: 'finance.read' },
  { to: '/quotations', label: 'Quotations', icon: FileText, perm: 'quotations.read' },
  { to: '/reports', label: 'Reports', icon: BarChart3, perm: 'reports.read' },
  { to: '/settings', label: 'Settings', icon: Settings, perm: 'admin.config' },
];

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['search', q],
    queryFn: async () => (await api.get('/search', { params: { q } })).data,
    enabled: q.length >= 2,
  });
  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Search leads, accounts, units, bookings…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && q.length >= 2 && data && (
        <div className="absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border bg-surface shadow-lg">
          {(['leads', 'accounts', 'opportunities', 'units', 'bookings'] as const).map((grp) =>
            data[grp]?.length ? (
              <div key={grp} className="border-b last:border-0">
                <div className="px-3 py-1.5 text-xs font-semibold uppercase text-slate-400">{grp}</div>
                {data[grp].map((it: any) => (
                  <button
                    key={it.id}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onMouseDown={() => {
                      const path = grp === 'units' ? 'inventory' : grp;
                      navigate(`/${path}/${it.id}`);
                    }}
                  >
                    {it.name ?? it.unitNumber ?? it.bookingNumber} <span className="text-slate-400">{it.stage ?? it.status ?? ''}</span>
                  </button>
                ))}
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications', { params: { unread: true } })).data,
    refetchInterval: 30_000,
  });
  const count = data?.unreadCount ?? 0;
  return (
    <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  return (
    <div className="relative">
      <button
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        title="Change theme"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <Palette className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-surface py-1 shadow-lg">
          <div className="px-3 py-1.5 text-xs font-semibold uppercase text-slate-400">Theme</div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              onMouseDown={() => setTheme(t.id)}
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-slate-200"
                style={{ backgroundColor: t.swatch }}
              />
              <span className="flex-1">{t.label}</span>
              {theme === t.id && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, clear, can } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    try { await api.post('/auth/logout', { refreshToken: useAuth.getState().refreshToken }); } catch { /* ignore */ }
    clear();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`flex flex-col border-r border-slate-200 bg-surface transition-all ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">R</div>
          {!collapsed && <span className="font-semibold text-slate-800">Reality CRM</span>}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.filter((n) => !n.perm || can(n.perm)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <n.icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 border-t px-4 py-3 text-sm text-slate-500 hover:bg-slate-50"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-slate-200 bg-surface px-6">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitcher />
            <NotificationBell />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {user?.name?.[0] ?? '?'}
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium text-slate-700">{user?.name}</div>
                <div className="text-xs text-slate-400">{user?.roleLabel ?? user?.role}</div>
              </div>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Log out">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
