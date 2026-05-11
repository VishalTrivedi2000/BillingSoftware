import { Outlet } from 'react-router-dom';
import { InvoiceComposerTabStrip } from './InvoiceComposerTabStrip';

export function InvoiceComposerLayout() {
  return (
    <div className="flex min-h-0 w-full max-w-none flex-1 flex-col">
      <InvoiceComposerTabStrip />
      <Outlet />
    </div>
  );
}
