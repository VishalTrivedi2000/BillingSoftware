import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function InvoiceComposerIndexRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const id = crypto.randomUUID();
    const qs = searchParams.toString();
    navigate(`/invoices/new/${id}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-slate-400">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" aria-hidden />
      Opening invoice composer…
    </div>
  );
}
