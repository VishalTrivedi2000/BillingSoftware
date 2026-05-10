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

/** Matches API static hosting (`ProductImages:PublicRequestPath`, default `/uploads/products`). */
const PRODUCT_UPLOADS_PUBLIC_PREFIX = '/uploads/products';

/**
 * Builds a browser-usable URL for a product image stored as a path under the uploads root
 * (e.g. `tenantId/orgId/productId/guid.jpg`). With `VITE_BASE_API_URL=/api`, uses same-origin
 * `/uploads/...` so Vite can proxy alongside `/api`.
 */
export function productImageUrl(relativePath: string | null | undefined): string | null {
  const trimmed = relativePath?.trim();
  if (!trimmed) return null;
  const rel = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
  const base = getBaseApiUrl();
  if (/^https?:\/\//i.test(base)) {
    try {
      const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
      const origin = new URL(normalized).origin;
      return `${origin}${PRODUCT_UPLOADS_PUBLIC_PREFIX}/${rel}`;
    } catch {
      return null;
    }
  }
  return `${PRODUCT_UPLOADS_PUBLIC_PREFIX}/${rel}`;
}
