const TOKEN_KEY = "tradej_token";

export function getStoredToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const init: RequestInit = {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  };

  const url = path.startsWith("http") ? path : `/api${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = res.statusText;
    let details: unknown;
    try {
      const data = await res.json();
      message = data.error ?? message;
      details = data.details;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
