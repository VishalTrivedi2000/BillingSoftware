/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for REST (must end with `/api`). Default `/api` in code when unset. */
  readonly VITE_BASE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEV_SERVER_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
