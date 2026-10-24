import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/** Legacy `/purchases/drafts/:id` URLs open the multi-tab composer with that draft loaded. */
export function PurchaseDraftRedirect() {
  const navigate = useNavigate();
  const { draftPurchaseBillId } = useParams<{ draftPurchaseBillId: string }>();

  useEffect(() => {
    const raw = draftPurchaseBillId ? Number(draftPurchaseBillId) : NaN;
    if (!Number.isFinite(raw) || raw <= 0 || !Number.isInteger(raw)) {
      navigate('/purchases/new', { replace: true });
      return;
    }
    const tabId = crypto.randomUUID();
    navigate(`/purchases/new/${tabId}?loadDraft=${Math.floor(raw)}`, { replace: true });
  }, [draftPurchaseBillId, navigate]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-slate-400">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" aria-hidden />
      Opening purchase composer…
    </div>
  );
}
