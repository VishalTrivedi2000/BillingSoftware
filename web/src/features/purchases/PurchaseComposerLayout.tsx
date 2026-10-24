import { Outlet } from 'react-router-dom';
import { PurchaseComposerTabStrip } from './PurchaseComposerTabStrip';

export function PurchaseComposerLayout() {
  return (
    <div className="flex min-h-0 w-full max-w-none flex-1 flex-col">
      <PurchaseComposerTabStrip />
      <Outlet />
    </div>
  );
}
