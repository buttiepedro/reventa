import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
    <div className="min-h-screen flex items-center justify-center bg-white px-6 relative overflow-hidden">
      {/* Atmospheric blobs */}
      <div
        className="absolute -top-32 -left-32 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(22,163,74,0.10) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-24 -right-16 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(22,163,74,0.06) 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-sm animate-fade-up relative">
        {/* Brand mark */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-black text-sm leading-none">R</span>
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">Reventa</span>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            La red de concesionarias de confianza.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="usuario@empresa.com"
                className="w-full bg-transparent border-b-2 border-slate-200 focus:border-green-500 outline-none py-2 text-slate-900 placeholder:text-slate-300 text-base transition-colors duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent border-b-2 border-slate-200 focus:border-green-500 outline-none py-2 text-slate-900 placeholder:text-slate-300 text-base transition-colors duration-200"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" loading={submitting} className="w-full mt-2" size="lg">
            {submitting ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
