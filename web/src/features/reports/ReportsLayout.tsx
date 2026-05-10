import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';

const NAV_GROUPS: { title: string; items: { to: string; label: string }[] }[] = [
  {
    title: 'Transaction reports',
    items: [
      { to: '/reports/sale-invoices', label: 'Sale invoices' },
      { to: '/reports/purchase-bills', label: 'Purchase bills' },
      { to: '/reports/day-book', label: 'Day book' },
      { to: '/reports/all-transactions', label: 'All transactions' },
    ],
  },
  {
    title: 'Party reports',
    items: [{ to: '/reports/party-statement', label: 'Party statement' }],
  },
  {
    title: 'GST & accounts',
    items: [
      { to: '/reports/gst-summary', label: 'GST summary' },
      { to: '/reports/profit-loss', label: 'Profit & loss' },
    ],
  },
];

export function ReportsLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-0">
      <aside className="workspace-panel-soft shrink-0 lg:w-56 lg:rounded-none lg:rounded-l-2xl lg:border-r lg:border-app-line xl:w-64">
        <div className="border-b border-app-line p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-app-nav-section">
            <BarChart3 className="h-4 w-4 text-[rgb(var(--accent-rgb))]" aria-hidden />
            Reports
          </p>
          <p className="text-app-crumb mt-1 text-[11px] leading-snug">Vyapar-style views — filters + exports.</p>
        </div>
        <nav className="max-h-[40vh] overflow-y-auto p-2 lg:max-h-none">
          {NAV_GROUPS.map((g) => (
            <div key={g.title} className="mb-4">
              <p className="text-app-nav-section mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide">{g.title}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        [
                          'block rounded-lg px-3 py-2 text-sm transition',
                          isActive
                            ? 'theme-nav-active theme-nav-active-shadow font-semibold'
                            : 'text-app-nav-link bg-app-nav-hover text-app-nav-link-hover',
                        ].join(' ')
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 space-y-6 lg:py-0">
        <Outlet />
      </div>
    </div>
  );
}
