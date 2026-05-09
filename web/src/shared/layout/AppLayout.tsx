import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  Keyboard,
  Menu,
  Search,
  X,
} from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { navSections } from './navConfig';
import { UserMenu } from './UserMenu';
import { WorkplaceBadge } from './WorkplaceBadge';

function crumbTrail(pathname: string): string[] {
  if (pathname === '/dashboard') return ['Billing workspace', 'Dashboard'];
  if (pathname === '/invoices' || pathname === '/invoices/new') return ['Billing workspace', 'Invoices'];
  if (pathname.startsWith('/invoices/')) return ['Billing workspace', 'Invoices', 'Detail'];
  if (pathname === '/customers') return ['Billing workspace', 'Customers'];
  if (pathname === '/products') return ['Billing workspace', 'Products'];
  if (pathname === '/profile') return ['Billing workspace', 'Profile'];
  return ['Billing workspace'];
}

export function AppLayout() {
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const crumbs = useMemo(() => crumbTrail(location.pathname), [location.pathname]);
  const pageTitle = crumbs[crumbs.length - 1] ?? 'Billing';

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sections = navSections();

  const sidebarInner = (
    <>
      <div className="border-b border-white/10 px-5 py-6">
        <Link to="/dashboard" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-blue-600/30">
            B
          </span>
          <div>
            <p className="font-semibold leading-tight text-slate-100">Billing workspace</p>
            <p className="text-xs text-slate-500">BS · tenants & invoices</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map(({ title, items }) => (
          <div key={title} className="mb-6">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/dashboard'}
                      className={({ isActive }) =>
                        [
                          'group flex gap-3 rounded-xl px-3 py-2.5 transition',
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                        ].join(' ')
                      }
                    >
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-90" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span
                          className={`block truncate text-[11px] leading-snug ${location.pathname === item.to ? 'text-blue-100/90' : 'text-slate-600 group-hover:text-slate-500'}`}
                        >
                          {item.description}
                        </span>
                      </span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <p className="text-[10px] text-slate-600">BillingApp.Api · SQL Server · JWT RBAC</p>
        <Link to="/" className="mt-2 inline-block text-xs font-medium text-blue-400 hover:text-blue-300">
          Marketing site →
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        {/* Sidebar desktop */}
        <aside className="relative z-50 hidden w-[272px] shrink-0 flex-col border-r border-white/10 bg-[#0a0f1a] lg:flex">
          {sidebarInner}
        </aside>

        {/* Sidebar mobile */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(288px,92vw)] flex-col border-r border-white/10 bg-[#0a0f1a] shadow-2xl transition-transform duration-200 lg:hidden ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-end border-b border-white/10 px-3 py-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {sidebarInner}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070a12]/90 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-500">
                  {crumbs.join(' / ')}
                </p>
                <h1 className="truncate text-lg font-bold tracking-tight text-white lg:text-xl">{pageTitle}</h1>
              </div>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-500 transition hover:border-white/15 hover:bg-white/[0.07] md:flex lg:max-w-lg"
              >
                <Search className="hidden h-4 w-4 shrink-0 lg:inline" aria-hidden />
                <span className="flex-1 text-left">Search routes and pages…</span>
                <kbd className="flex items-center gap-0.5 rounded border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                  <Keyboard className="inline h-3 w-3" aria-hidden /> Ctrl K
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 md:hidden"
                aria-label="Open command palette"
              >
                <Keyboard className="h-5 w-5" />
              </button>

              <button
                type="button"
                className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 opacity-60"
                title="Notifications — coming soon"
                disabled
              >
                <Bell className="h-5 w-5" aria-hidden />
              </button>

              <WorkplaceBadge />
              <UserMenu />
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
