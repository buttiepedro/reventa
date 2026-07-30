import { api } from "./api";

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company_id: string | null;
}

export async function login(email: string, password: string): Promise<User> {
  const form = new FormData();
  form.append("username", email);
  form.append("password", password);

  const response = await fetch((import.meta.env.VITE_API_URL ?? "/api/v1") + "/auth/token", {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error("Credenciales incorrectas");
  const data: TokenResponse = await response.json();
  localStorage.setItem("access_token", data.access_token);

  const user = await api.get<User>("/auth/me");
  localStorage.setItem("user", JSON.stringify(user));

  await registerPush();
  return user;
}

export function logout(): void {
  unregisterPush().catch(() => {});
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

export function getUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem("user") ?? "null");
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("access_token");
}

async function registerPush(): Promise<void> {
  const vapidRes = await api.get<{ vapid_public_key: string | null }>("/push/vapid-public-key").catch(() => null);
  if (!vapidRes?.vapid_public_key) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidRes.vapid_public_key),
    });
    await api.post("/push/subscribe", {
      endpoint: sub.endpoint,
      p256dh: arrayBufferToBase64(sub.getKey("p256dh")!),
      auth: arrayBufferToBase64(sub.getKey("auth")!),
    });
  } catch {
    // Push not available or denied — non-fatal
  }
}

async function unregisterPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  await api.delete("/push/subscribe").catch(() => {});
  await sub.unsubscribe();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
