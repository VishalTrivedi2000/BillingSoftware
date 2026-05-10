import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LogOut, Shield, User } from 'lucide-react';
import type { AuthUserSummary } from '../../entities/auth-types';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { clearSession, selectIsAuthenticated } from '../../features/auth/authSlice';
import { apiJsonAuth } from '../api/axiosClient';

export function UserMenu() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authed = useAppSelector(selectIsAuthenticated);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const summaryQ = useQuery({
    queryKey: ['auth-me-header'],
    queryFn: () => apiJsonAuth<AuthUserSummary>('/v1/auth/me'),
    enabled: authed,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!authed) {
    return (
      <Link
        to="/login"
        className="rounded-xl bg-[rgb(var(--accent-rgb))] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[rgb(var(--accent-rgb)/0.25)] hover:brightness-110"
      >
        Sign in
      </Link>
    );
  }

  const s = summaryQ.data;
  const initials = (s?.username ?? '?').slice(0, 2).toUpperCase();
  const primaryRole = s?.roles?.[0] ?? 'Member';
  const permCount = s?.permissions?.length ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="theme-header-chip flex items-center gap-3 rounded-xl px-3 py-2 transition hover:brightness-110"
        aria-expanded={open}
      >
        <span className="hidden rounded-lg bg-[rgb(var(--accent-rgb))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:inline">
          {primaryRole}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[rgb(var(--logo-from-rgb))] to-[rgb(var(--logo-to-rgb))] text-sm font-bold text-white shadow-[0_6px_18px_-4px_rgb(var(--accent-rgb)/0.45)]">
          {initials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="text-app-page-title block truncate text-sm font-semibold">{s?.username ?? '…'}</span>
          <span className="text-app-crumb block truncate text-xs">Tenant / org from JWT</span>
        </span>
        <ChevronDown className={`text-app-crumb h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="theme-elevated-surface absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-xl">
          <div className="border-b border-app-line px-4 py-4">
            <div className="flex items-start gap-3">
              <User className="text-elevated-muted mt-0.5 h-5 w-5" aria-hidden />
              <div className="min-w-0">
                <p className="text-elevated-primary truncate font-semibold">{s?.username ?? 'Signed in'}</p>
                <p className="text-elevated-muted mt-1 flex items-center gap-1.5 text-xs">
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  {primaryRole}
                  {s?.roles && s.roles.length > 1 ? ` +${s.roles.length - 1}` : ''}
                </p>
              </div>
            </div>
            <div className="theme-kbd-chip mt-3 rounded-lg px-3 py-2">
              <p className="text-elevated-muted text-[10px] font-semibold uppercase tracking-wide">Permissions</p>
              <p className="text-elevated-primary text-sm font-semibold">{permCount} granted</p>
            </div>
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="text-elevated-primary bg-app-nav-hover block px-4 py-3 text-sm font-medium transition"
          >
            Profile & workplace
          </Link>
          <button
            type="button"
            onClick={() => {
              dispatch(clearSession());
              setOpen(false);
              navigate('/login');
            }}
            className="flex w-full items-center gap-2 border-t border-app-line px-4 py-3 text-left text-sm font-semibold text-rose-500 transition hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
