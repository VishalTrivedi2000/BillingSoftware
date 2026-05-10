import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  Keyboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from 'lucide-react';
import { usePermissions } from '../auth/usePermissions';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { toggleSidebar } from '../../features/layout/uiSlice';
import { CommandPalette } from './CommandPalette';
import { navSections } from './navConfig';
import { UserMenu } from './UserMenu';
import { WorkplaceBadge } from './WorkplaceBadge';
import { WorkspaceOutlet } from './WorkspaceOutlet';

function crumbTrail(pathname: string): string[] {
  if (pathname.startsWith('/reports')) {
    const map: Record<string, string> = {
      '/reports': 'Sale invoices',
      '/reports/sale-invoices': 'Sale invoices',
      '/reports/purchase-bills': 'Purchase bills',
      '/reports/day-book': 'Day book',
      '/reports/all-transactions': 'All transactions',
      '/reports/party-statement': 'Party statement',
      '/reports/gst-summary': 'GST summary',
      '/reports/profit-loss': 'Profit & loss',
    };
    const leaf = map[pathname] ?? 'Reports';
    return ['Billing workspace', 'Reports', leaf];
  }
  if (pathname === '/dashboard') return ['Billing workspace', 'Dashboard'];
  if (pathname === '/sales') return ['Billing workspace', 'Sales'];
  if (pathname.startsWith('/invoices/new')) return ['Billing workspace', 'Sales', 'Invoices', 'New invoice'];
  if (pathname === '/invoices') return ['Billing workspace', 'Sales', 'Invoices'];
  if (pathname.startsWith('/invoices/')) return ['Billing workspace', 'Sales', 'Invoices', 'Detail'];
  if (pathname === '/purchases') return ['Billing workspace', 'Purchases'];
  if (pathname.startsWith('/purchases/new')) return ['Billing workspace', 'Purchases', 'New purchase'];
  if (pathname.startsWith('/purchases/drafts/')) return ['Billing workspace', 'Purchases', 'Draft'];
  if (/^\/purchases\/[^/]+\/print$/.test(pathname)) return ['Billing workspace', 'Purchases', 'Print'];
  if (pathname.startsWith('/purchases/')) return ['Billing workspace', 'Purchases', 'Detail'];
  if (pathname === '/customers') return ['Billing workspace', 'Customers'];
  if (pathname === '/parties') return ['Billing workspace', 'Parties'];
  if (pathname === '/products') return ['Billing workspace', 'Products'];
  if (pathname === '/profile') return ['Billing workspace', 'Profile'];
  if (pathname === '/settings') return ['Billing workspace', 'Settings'];
  if (pathname.startsWith('/settings/rbac')) {
    if (pathname === '/settings/rbac/permissions') return ['Billing workspace', 'Settings', 'RBAC', 'Permissions'];
    if (/^\/settings\/rbac\/roles\/[^/]+$/.test(pathname)) return ['Billing workspace', 'Settings', 'RBAC', 'Role'];
    return ['Billing workspace', 'Settings', 'RBAC', 'Roles'];
  }
  return ['Billing workspace'];
}

export function AppLayout() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const userSidebarCollapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const isInvoiceComposer = location.pathname.startsWith('/invoices/new');
  const isPurchaseComposer = location.pathname.startsWith('/purchases/new');
  const [purchaseSidebarExpanded, setPurchaseSidebarExpanded] = useState(false);

  useEffect(() => {
    if (!isPurchaseComposer) setPurchaseSidebarExpanded(false);
  }, [isPurchaseComposer, location.pathname]);

  const sidebarCollapsed =
    userSidebarCollapsed || (isPurchaseComposer && !purchaseSidebarExpanded);

  const compactWorkspaceRail = isInvoiceComposer || isPurchaseComposer;

  const { can } = usePermissions();
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

  const sections = useMemo(
    () =>
      navSections()
        .map(({ title, items }) => ({
          title,
          items: items.filter((item) => !item.requiredPermission || can(item.requiredPermission)),
        }))
        .filter((s) => s.items.length > 0),
    [can],
  );

  const sidebarInner = (
    <>
      <div className={`border-b border-app-line ${sidebarCollapsed ? 'px-2 py-5' : 'px-5 py-6'}`}>
        <Link to="/dashboard" className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[rgb(var(--logo-from-rgb))] to-[rgb(var(--logo-to-rgb))] text-lg font-bold text-white shadow-[0_10px_25px_-5px_rgb(var(--accent-rgb)/0.35)]">
            B
          </span>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="font-semibold leading-tight text-app-sidebar-title">Billing workspace</p>
              <p className="text-xs text-app-sidebar-tagline">BS · tenants & invoices</p>
            </div>
          )}
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4 lg:px-3">
        {sections.map(({ title, items }) => (
          <div key={title} className="mb-6">
            {!sidebarCollapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-nav-section">{title}</p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      title={sidebarCollapsed ? `${item.label} — ${item.description}` : undefined}
                      end={
                        item.to === '/dashboard' ||
                        item.to === '/sales' ||
                        item.to === '/invoices' ||
                        item.to === '/purchases'
                      }
                      className={({ isActive }) =>
                        [
                          'group flex gap-3 rounded-xl py-2.5 transition',
                          sidebarCollapsed ? 'justify-center px-2' : 'px-3',
                          isActive
                            ? 'theme-nav-active theme-nav-active-shadow'
                            : 'text-app-nav-link bg-app-nav-hover text-app-nav-link-hover',
                        ].join(' ')
                      }
                    >
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-90" aria-hidden />
                      {!sidebarCollapsed && (
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span
                            className={`block truncate text-[11px] leading-snug ${
                              location.pathname === item.to ? 'text-app-nav-desc-active' : 'text-app-nav-desc'
                            }`}
                          >
                            {item.description}
                          </span>
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {!sidebarCollapsed && (
        <div className="border-t border-app-line px-4 py-4">
          <p className="text-[10px] text-app-nav-desc">BillingApp.Api · SQL Server · JWT RBAC</p>
          <Link to="/" className="theme-accent-link mt-2 inline-block text-xs font-medium">
            Marketing site →
          </Link>
        </div>
      )}
    </>
  );

  return (
    <div className="bg-app-shell min-h-screen">
      <div className="no-print">
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <button
          type="button"
          className="no-print fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        {/* Sidebar desktop */}
        <aside
          data-app-sidebar
          className={`no-print relative z-[100] hidden shrink-0 flex-col border-r border-app-line bg-app-sidebar transition-[width] duration-200 ease-out lg:flex ${
            sidebarCollapsed ? 'w-[76px]' : 'w-[272px]'
          }`}
        >
          {sidebarInner}
        </aside>

        {/* Sidebar mobile */}
        <aside
          data-app-sidebar
          className={`no-print fixed inset-y-0 left-0 z-[100] flex w-[min(288px,92vw)] flex-col border-r border-app-line bg-app-sidebar shadow-2xl transition-transform duration-200 lg:hidden ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-end border-b border-app-line px-3 py-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg p-2 text-app-nav-link bg-app-nav-hover text-app-nav-link-hover"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {sidebarInner}
        </aside>

        <div className="relative z-0 isolate flex min-w-0 flex-1 flex-col">
          <header data-app-header className="app-header-bar no-print sticky top-0 z-30">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="theme-header-chip rounded-xl p-2 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isPurchaseComposer) {
                    setPurchaseSidebarExpanded((v) => !v);
                    return;
                  }
                  dispatch(toggleSidebar());
                }}
                title={
                  isPurchaseComposer
                    ? purchaseSidebarExpanded
                      ? 'Collapse sidebar'
                      : 'Expand sidebar (full-width composer)'
                    : sidebarCollapsed
                      ? 'Expand sidebar'
                      : 'Collapse sidebar'
                }
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-pressed={!sidebarCollapsed}
                className="theme-header-chip hidden rounded-xl p-2 lg:flex disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5 text-app-crumb" aria-hidden />
                ) : (
                  <PanelLeftClose className="h-5 w-5 text-app-crumb" aria-hidden />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-app-crumb">
                  {crumbs.join(' / ')}
                </p>
                <h1 className="text-app-page-title truncate text-lg font-bold tracking-tight lg:text-xl">{pageTitle}</h1>
              </div>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="theme-header-chip hidden max-w-md flex-1 items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition hover:brightness-110 md:flex lg:max-w-lg"
              >
                <Search className="hidden h-4 w-4 shrink-0 text-app-crumb lg:inline" aria-hidden />
                <span className="flex-1 text-left text-app-crumb">Search routes and pages…</span>
                <kbd className="theme-kbd-chip flex items-center gap-0.5 rounded px-2 py-0.5 font-mono text-[10px] text-app-crumb">
                  <Keyboard className="inline h-3 w-3" aria-hidden /> Ctrl K
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="theme-header-chip rounded-xl p-2 md:hidden"
                aria-label="Open command palette"
              >
                <Keyboard className="h-5 w-5" aria-hidden />
              </button>

              <button
                type="button"
                className="theme-header-chip relative rounded-xl p-2 opacity-60"
                title="Notifications — coming soon"
                disabled
              >
                <Bell className="h-5 w-5" aria-hidden />
              </button>

              <WorkplaceBadge />
              <UserMenu />
            </div>
          </header>

          <main
            className={`bg-app-main flex min-h-0 flex-1 flex-col ${
              compactWorkspaceRail ? 'px-2 py-4 sm:px-4 sm:py-5 lg:px-5 lg:py-6' : 'px-4 py-6 lg:px-8 lg:py-8'
            }`}
          >
            <WorkspaceOutlet />
          </main>
        </div>
      </div>
    </div>
  );
}
