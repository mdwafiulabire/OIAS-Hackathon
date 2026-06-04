const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface FetchOptions extends RequestInit {
  token?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...init } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include', // send auth cookies
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText, code: 'UNKNOWN' } }));
    if (res.status === 401 && typeof window !== 'undefined') {
      // Stale or missing session → bounce to login. Avoid loop if already there.
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.replace('/login');
      }
    }
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Request failed',
      res.status,
    );
  }

  return res.json();
}
