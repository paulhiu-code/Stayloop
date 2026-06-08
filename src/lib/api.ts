import { supabase } from './supabase';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | null;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const body =
    options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
      ? JSON.stringify(options.body)
      : options.body;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    body,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with ${response.status}`);
  }

  return payload as T;
}
