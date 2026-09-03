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

// ─── Token Refresh Queue ──────────────────────────────────────────────

let isRefreshing = false;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
};

let failedQueue: PendingRequest[] = [];

const processQueue = (error: any | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(null);
    }
  });
  failedQueue = [];
};

// ─── Response Interceptor ─────────────────────────────────────────────

/**
 * Endpoints whose own 401 is the answer, not an expired session.
 *
 * A wrong password on /auth/login answers 401; refreshing after it asks for a new token with
 * no session to refresh, that answers 401 "No refresh token", and the caller was handed *that*
 * message — so the login form said the refresh token was missing instead of saying the
 * password was wrong. These reject with what the server actually said.
 */
const NO_REFRESH_ON = [
  '/auth/login',
  '/auth/refresh',
  '/auth/register',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If not 401 or already retried → reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // An authentication call's own 401 is final — there is no session to refresh
    const url = String(originalRequest?.url ?? '');
    if (NO_REFRESH_ON.some((path) => url.includes(path))) {
      return Promise.reject(error);
    }

    // Prevent infinite loop
    originalRequest._retry = true;

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      // Call refresh endpoint – backend reads refresh token from httpOnly cookie
      // and sets a new access token cookie
      await axios.post('/api/auth/refresh', {}, { withCredentials: true });

      // Process queued requests
      processQueue(null);

      // Retry the original request
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed – reject the error and let the calling code handle it.
      // The route guards in App.tsx will redirect to login if needed.
      processQueue(refreshError);

      // Optional: you can clear any client-side auth state here (e.g., setUser(null))
      // But that should be done in the AuthContext based on the 401 response.

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);