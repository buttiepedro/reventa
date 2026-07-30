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
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    const raw = error.detail;
    const detail = Array.isArray(raw)
      ? raw.map((e: { msg?: string }) => e.msg ?? String(e)).join(" · ")
      : (raw ?? "Request failed");
    throw { detail, status: response.status };
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function requestForm<T>(endpoint: string, form: FormData, method = "POST"): Promise<T> {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    const raw = error.detail;
    const detail = Array.isArray(raw)
      ? raw.map((e: { msg?: string }) => e.msg ?? String(e)).join(" · ")
      : (raw ?? "Request failed");
    throw { detail, status: response.status };
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "POST", body: JSON.stringify(body) }),
  postForm: <T>(endpoint: string, form: FormData) => requestForm<T>(endpoint, form),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = void>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
