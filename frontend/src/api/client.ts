import axios from 'axios';

/**
 * API client for the Superfans backend.
 * In dev, Vite proxies /api → http://localhost:5000 (see vite.config.ts).
 * Auth uses httpOnly cookies, so every request carries credentials.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Central place for 401-refresh logic (wired up in M1)
    return Promise.reject(error);
  },
);
