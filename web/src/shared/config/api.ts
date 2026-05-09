/**
 * Single source for API calls: `import.meta.env.VITE_BASE_API_URL`
 * Examples:
 * - Dev + proxy: `/api` → Vite forwards to ASP.NET (see vite.config.ts)
 * - Direct HTTPS: `https://localhost:7256/api`
 */
export function getBaseApiUrl(): string {
  const raw = import.meta.env.VITE_BASE_API_URL?.trim();
  if (!raw) return '/api';
  return raw.replace(/\/$/, '');
}

/** Path must include version segment, e.g. `/v1/health` (base already ends with `/api`). */
export function apiUrl(path: string): string {
  const base = getBaseApiUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
