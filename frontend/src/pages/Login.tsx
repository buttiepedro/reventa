import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import type { ApiError } from "@/types";

const REDIRECT: Record<string, string> = {
  super_admin: "/admin/companies",
  company_admin: "/vehicles",
  company_user: "/vehicles",
};

export function Login() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate(REDIRECT[user.role] ?? "/", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as ApiError).detail ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "2.5rem",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          width: "100%",
          maxWidth: 400,
        }}
      >
        <h1 style={{ marginBottom: "1.5rem", fontSize: "1.5rem" }}>Reventa — Sign in</h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.9rem" }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.9rem" }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" }}
            />
          </label>

          {error && <p style={{ color: "#dc2626", margin: 0, fontSize: "0.9rem" }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "0.75rem",
              borderRadius: 6,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
