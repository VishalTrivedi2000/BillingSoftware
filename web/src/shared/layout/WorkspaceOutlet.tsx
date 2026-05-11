import { Outlet, matchPath, useLocation } from 'react-router-dom';
import { InvoiceComposerProvider } from '../../features/invoices/InvoiceComposerContext';
import { PurchaseComposerProvider } from '../../features/purchases/PurchaseComposerContext';

/**
 * Wraps the main workspace `<Outlet />` with invoice/purchase composer providers when needed.
 * Providers live here (above nested layouts) so tab strips and leaf pages always share one context
 * — avoids RR v7 / nesting edge cases where a layout provider did not wrap sibling outlets reliably.
 */
export function WorkspaceOutlet() {
  const location = useLocation();
  const path = location.pathname;

  if (path.startsWith('/invoices/new')) {
    const m = matchPath({ path: '/invoices/new/:tabId', end: true }, path);
    return (
      <InvoiceComposerProvider routeTabId={m?.params.tabId}>
        <Outlet />
      </InvoiceComposerProvider>
    );
  }

  if (path.startsWith('/purchases/new')) {
    const m = matchPath({ path: '/purchases/new/:tabId', end: true }, path);
    return (
      <PurchaseComposerProvider routeTabId={m?.params.tabId}>
        <Outlet />
      </PurchaseComposerProvider>
    );
  }

  return <Outlet />;
}
