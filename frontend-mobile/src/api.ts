const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Error" }));
    throw { detail: err.detail ?? "Request failed", status: response.status };
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function requestForm<T>(endpoint: string, form: FormData): Promise<T> {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Error" }));
    throw { detail: err.detail ?? "Request failed", status: response.status };
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(ep: string) => request<T>(ep),
  post: <T>(ep: string, body: unknown) => request<T>(ep, { method: "POST", body: JSON.stringify(body) }),
  postForm: <T>(ep: string, form: FormData) => requestForm<T>(ep, form),
  delete: <T = void>(ep: string) => request<T>(ep, { method: "DELETE" }),
};
