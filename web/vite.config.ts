import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Dev-only proxy derived from VITE_BASE_API_URL so one env drives UI + Vite. */
function devProxyFromBaseApi(env: Record<string, string>): Record<string, object> {
  const raw = env.VITE_BASE_API_URL?.trim() || '/api';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const normalized = raw.endsWith('/') ? raw.slice(0, -1) : raw;
      const url = new URL(normalized);
      const origin = url.origin;
      let pathname = url.pathname.replace(/\/$/, '');
      if (!pathname || pathname === '/') pathname = '/api';

      return {
        [pathname]: {
          target: origin,
          changeOrigin: true,
          secure: false,
        },
      };
    } catch {
      /* fall through */
    }
  }

  const prefix = raw.startsWith('/') ? raw.replace(/\/$/, '') || '/api' : '/api';
  const target = 'http://localhost:5151';
  return {
    [prefix]: {
      target,
      changeOrigin: true,
    },
    '/uploads': {
      target,
      changeOrigin: true,
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number(env.VITE_DEV_SERVER_PORT || 5173);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number.isFinite(devPort) ? devPort : 5173,
      proxy: devProxyFromBaseApi(env),
    },
  };
});
