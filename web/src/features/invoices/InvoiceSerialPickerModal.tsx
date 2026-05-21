import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search, X } from 'lucide-react';
import type { ProductSerialDto } from '../../entities/inventory';
import { inventoryApi } from '../inventory/inventoryApi';
import type { InvoiceSelectedSerial } from './invoiceComposerTypes';

type Props = {
  open: boolean;
  onClose: () => void;
  productId: number;
  productVariantId: number | null;
  warehouseId: number | '';
  alreadyPickedIds: number[];
  maxPick: number;
  onConfirm: (serials: InvoiceSelectedSerial[]) => void;
};

function toSelected(s: ProductSerialDto): InvoiceSelectedSerial {
  return {
    productSerialId: s.productSerialId,
    serialNumber: s.serialNumber,
    imei2: s.imei2,
    warehouseName: s.warehouseName,
    purchaseCostPerUnit: s.purchaseCostPerUnit,
  };
}

export function InvoiceSerialPickerModal({
  open,
  onClose,
  productId,
  productVariantId,
  warehouseId,
  alreadyPickedIds,
  maxPick,
  onConfirm,
}: Props) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<InvoiceSelectedSerial[]>([]);

  const serialsQ = useQuery({
    queryKey: ['invoice-serial-pick', productId, productVariantId, warehouseId, search],
    enabled: open && productVariantId != null,
    queryFn: () =>
      inventoryApi.serials.browse({
        productId,
        productVariantId: productVariantId ?? undefined,
        warehouseId: warehouseId === '' ? undefined : warehouseId,
        status: 'Available',
        search: search.trim() || undefined,
        take: 100,
      }),
    retry: 1,
  });

  const blocked = useMemo(() => new Set(alreadyPickedIds), [alreadyPickedIds]);

  const rows = useMemo(() => {
    return (serialsQ.data?.items ?? []).filter((s) => !blocked.has(s.productSerialId));
  }, [serialsQ.data, blocked]);

  if (!open) return null;

  function toggle(s: ProductSerialDto) {
    const id = s.productSerialId;
    const exists = picked.some((p) => p.productSerialId === id);
    if (exists) {
      setPicked((prev) => prev.filter((p) => p.productSerialId !== id));
      return;
    }
    if (picked.length >= maxPick) return;
    setPicked((prev) => [...prev, toSelected(s)]);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Select IMEI / Serial</h2>
            <p className="text-xs text-slate-500">
              Choose up to {maxPick} available unit{maxPick === 1 ? '' : 's'} (In stock).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search IMEI / serial…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {productVariantId == null && (
            <p className="text-sm text-amber-800">Select a variant on the line before picking IMEI.</p>
          )}
          {serialsQ.isLoading && (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading serials…
            </div>
          )}
          {serialsQ.isError && (
            <p className="py-4 text-sm text-rose-600">Could not load serial numbers.</p>
          )}
          {!serialsQ.isLoading && productVariantId != null && rows.length === 0 && (
            <p className="py-4 text-sm text-slate-500">No available IMEI / serial units for this variant.</p>
          )}
          <ul className="space-y-2">
            {rows.map((s) => {
              const selected = picked.some((p) => p.productSerialId === s.productSerialId);
              return (
                <li key={s.productSerialId}>
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        selected ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-semibold text-slate-900">
                        {s.serialNumber}
                      </span>
                      {s.imei2 && (
                        <span className="text-xs text-slate-500">IMEI 2: {s.imei2}</span>
                      )}
                      <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        {s.warehouseName && <span>{s.warehouseName}</span>}
                        {s.variantDisplay && <span>{s.variantDisplay}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      In Stock
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-500">
            {picked.length} of {maxPick} selected
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={picked.length === 0}
              onClick={() => {
                onConfirm(picked);
                setPicked([]);
                setSearch('');
                onClose();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Confirm selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
