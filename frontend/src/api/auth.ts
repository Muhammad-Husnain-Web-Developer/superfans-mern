import { api } from './client';
import type { AuthUser } from '../context/AuthContext';

interface AuthResponse {
  success: boolean;
  data: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  role: 'user' | 'influencer' | 'business';
  name: string;
  email: string;
  password: string;
  acceptedTerms: true;
  usernameUrl?: string;
  categories?: string[];
  companyName?: string;
  referredInfluencer?: string;
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>('/auth/login', input);
  return data.data;
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>('/auth/register', input);
  return data.data;
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get<AuthResponse>('/auth/me');
    return data.data;
  } catch {
    // No/expired session — try one silent refresh
    try {
      const { data } = await api.post<AuthResponse>('/auth/refresh');
      return data.data;
    } catch {
      return null;
    }
  }
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
