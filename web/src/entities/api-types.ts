// Shared API types — use `plainApi` / `authApi` / `apiJson` from `src/shared/api` (Axios; base URL = VITE_BASE_API_URL).

export type HealthDto = {  status: string;
  sql: string;
};
