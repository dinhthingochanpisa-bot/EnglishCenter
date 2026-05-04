import { withApiBaseUrl } from './config';

async function tryRefreshToken() {
  const response = await fetch(withApiBaseUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.ok;
}

export async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const baseOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  };

  let response = await fetch(withApiBaseUrl(url), baseOptions);

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(withApiBaseUrl(url), baseOptions);
    }
  }

  if (response.status === 401) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ message: 'API Error' }));
    const message = Array.isArray(errorPayload.message)
      ? errorPayload.message.join(', ')
      : errorPayload.message || errorPayload.error || 'System error';
    throw new Error(message);
  }

  return response.json();
}
