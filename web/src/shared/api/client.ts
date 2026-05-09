import type { AxiosRequestConfig } from 'axios';
import { plainApi } from './axiosClient';

/** Public JSON GET (no bearer). Prefer over raw fetch so base URL stays aligned with Axios stack. */
export async function apiJson<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await plainApi.get<T>(path, config);
  return res.data;
}
