import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { WorkplaceCard } from './WorkplaceCard';
import { apiJsonAuth, authApi } from '../../shared/api/axiosClient';
import type { AuthUserSummary } from '../../entities/auth-types';
import { useAppDispatch } from '../../app/hooks';
import { clearSession } from '../../features/auth/authSlice';

export type UserProfile = {
  userId: number;
  username: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  bio: string | null;
  timeZone: string | null;
  locale: string | null;
  profilePictureUrl: string | null;
  updatedUtc: string;
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function formatUpdated(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-white/15 bg-[#1a1f2e] px-4 py-2.5 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20';

export function ProfilePage() {
  const dispatch = useAppDispatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [access, setAccess] = useState<AuthUserSummary | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [locale, setLocale] = useState('');

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4800);
    return () => clearTimeout(t);
  }, [success]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const p = await apiJsonAuth<UserProfile>('/v1/profile/me');
      setProfile(p);
      setDisplayName(p.displayName ?? '');
      setEmail(p.email ?? '');
      setPhone(p.phone ?? '');
      setJobTitle(p.jobTitle ?? '');
      setDepartment(p.department ?? '');
      setBio(p.bio ?? '');
      setTimeZone(p.timeZone ?? '');
      setLocale(p.locale ?? '');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load profile';
      setError(msg);
      setProfile(null);
      if (msg.includes('Unauthorized')) {
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadAccess();
  }, []);

  async function loadAccess() {
    setAccessError(null);
    setAccessLoading(true);
    try {
      const s = await apiJsonAuth<AuthUserSummary>('/v1/auth/me');
      setAccess(s);
    } catch (e) {
      setAccess(null);
      setAccessError(e instanceof Error ? e.message : 'Could not load access context.');
    } finally {
      setAccessLoading(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        department: department.trim(),
        bio: bio.trim(),
        timeZone: timeZone.trim(),
        locale: locale.trim(),
      };
      const p = await apiJsonAuth<UserProfile>('/v1/profile/me', {
        method: 'PATCH',
        data: body,
      });
      setProfile(p);
      setSuccess('Profile saved successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onPictureChange(file: File | null) {
    if (!file) return;
    setError(null);

    const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!okTypes.includes(file.type)) {
      setError('Please choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`Image must be ${MAX_PHOTO_BYTES / (1024 * 1024)} MB or smaller.`);
      return;
    }

    setUploadingPhoto(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data: p } = await authApi.post<UserProfile>('/v1/profile/me/picture', fd);
      setProfile(p);
      setSuccess('Profile photo updated.');
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (e.response?.status === 401) {
          dispatch(clearSession());
          window.location.href = '/login';
          return;
        }
        const d = e.response?.data;
        const text = typeof d === 'string' ? d : '';
        setError(text ? `Upload failed: ${text.slice(0, 120)}` : `Upload failed (${e.response?.status}).`);
        return;
      }
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removePicture() {
    setError(null);
    setUploadingPhoto(true);
    try {
      const { data: p } = await authApi.delete<UserProfile>('/v1/profile/me/picture');
      setProfile(p);
      setSuccess('Photo removed.');
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (e.response?.status === 401) {
          dispatch(clearSession());
          window.location.href = '/login';
          return;
        }
        setError(`Remove failed (${e.response?.status}).`);
        return;
      }
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" aria-hidden />
        <p className="text-sm font-medium text-slate-400">Loading your profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="workspace-panel border border-rose-500/25 bg-rose-500/5 px-6 py-10 text-center">
        <p className="font-semibold text-rose-200">Could not load profile</p>
        <p className="mt-2 text-sm text-rose-300/90">{error ?? 'Unknown error.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Retry
          </button>
          <Link to="/login" className="rounded-xl border border-rose-400/40 px-5 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-500/10">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const initials = (profile.displayName ?? profile.username).slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <WorkplaceCard />

      <div className="workspace-panel space-y-4 p-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Access &amp; ABAC</h2>
          <p className="mt-1 text-xs text-slate-600">
            Workplace-aware JWT claims; scoped grants attach optional <span className="font-mono">resourceScope</span> interpreted by the API (similar to LockSystem backend-driven ABAC).
          </p>
        </div>
        {accessLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border border-teal-400/30 border-t-teal-400" aria-hidden />
            Loading access context…
          </div>
        ) : accessError ? (
          <p role="alert" className="text-sm text-rose-300">
            {accessError}
          </p>
        ) : access ? (
          <>
            <div className="grid gap-3 text-xs text-slate-400 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-slate-500">Effective roles </span>
                <span className="text-slate-300">{access.roles.length ? access.roles.join(', ') : '—'}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Permission claims </span>
                <span className="text-slate-300">{access.permissions.length}</span>
              </p>
            </div>
            {access.activePermissionGrants.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Permission</th>
                      <th className="px-3 py-2">Resource scope</th>
                      <th className="px-3 py-2">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-slate-300">
                    {access.activePermissionGrants.map((g) => (
                      <tr key={g.grantId}>
                        <td className="px-3 py-2 font-mono text-[11px] text-teal-100">{g.permission}</td>
                        <td className="max-w-[280px] truncate px-3 py-2 font-mono text-[10px] text-slate-500" title={g.resourceScope ?? ''}>
                          {g.resourceScope ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{g.expiresUtc ? formatUpdated(g.expiresUtc) : 'Open-ended'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-600">No active permission grants with explicit scopes.</p>
            )}
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-400/90">Account</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Profile
          </h1>
          <p className="mt-2 max-w-xl text-slate-400">
            Manage how you appear in the workspace, contact details, and your avatar. Changes sync to the API immediately.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Last updated{' '}
          <time dateTime={profile.updatedUtc} className="font-medium text-slate-300">
            {formatUpdated(profile.updatedUtc)}
          </time>
        </p>
      </div>

      {success && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
        >
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-300 underline-offset-2 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Photo card */}
        <div className="workspace-panel h-fit space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Photo</h2>
          <div className="relative mx-auto w-fit">
            <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-white/10 shadow-lg shadow-black/40 ring-2 ring-teal-500/30">
              {profile.profilePictureUrl ? (
                <img src={profile.profilePictureUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-100 to-emerald-100 text-2xl font-bold text-teal-800">
                  {initials}
                </div>
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px]">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => void onPictureChange(e.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            disabled={uploadingPhoto}
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 transition hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50"
          >
            {uploadingPhoto ? 'Working…' : 'Upload new photo'}
          </button>

          <p className="text-center text-xs text-slate-500">JPEG, PNG, WebP or GIF · max 5 MB</p>

          {profile.profilePictureUrl && (
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => void removePicture()}
              className="w-full rounded-xl border border-white/15 py-2 text-sm font-medium text-slate-300 transition hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
            >
              Remove photo
            </button>
          )}
        </div>

        {/* Forms */}
        <div className="space-y-8">
          <form onSubmit={(e) => void onSave(e)} className="workspace-panel p-6 sm:p-8">
            <div className="border-b border-white/10 pb-6">
              <h2 className="text-lg font-semibold text-white">Identity</h2>
              <p className="mt-1 text-sm text-slate-500">Username is managed by your administrator.</p>
              <div className="mt-4 rounded-xl bg-white/5 px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Username</span>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-100">{profile.username}</p>
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-medium text-slate-300">Display name</span>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="Jane Doe" />
              </label>
            </div>

            <div className="grid gap-6 border-b border-white/10 py-8 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h2 className="text-lg font-semibold text-white">Contact</h2>
                <p className="mt-1 text-sm text-slate-500">Used for notifications and directory lookup.</p>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@company.com" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Phone</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+1 …" />
              </label>
            </div>

            <div className="grid gap-6 border-b border-white/10 py-8 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h2 className="text-lg font-semibold text-white">Work</h2>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Job title</span>
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inputClass} placeholder="Billing analyst" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Department</span>
                <input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} placeholder="Finance" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-300">Bio</span>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`${inputClass} resize-y`}
                  placeholder="Short introduction for your colleagues…"
                />
              </label>
            </div>

            <div className="grid gap-6 pt-8 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h2 className="text-lg font-semibold text-white">Preferences</h2>
                <p className="mt-1 text-sm text-slate-500">Regional formatting for future billing UI.</p>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Time zone (IANA)</span>
                <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={inputClass} placeholder="America/New_York" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Locale</span>
                <input value={locale} onChange={(e) => setLocale(e.target.value)} className={inputClass} placeholder="en-US" />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-8">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-white/5"
              >
                Reset form
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
