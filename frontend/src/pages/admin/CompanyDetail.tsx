import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "@/services/api";
import type { ApiError, Company, User } from "@/types";

const ROLE_OPTIONS = [
  { value: "company_user", label: "User" },
  { value: "company_admin", label: "Admin" },
];

interface UserForm {
  full_name: string;
  email: string;
  password: string;
  role: string;
}

const EMPTY_FORM: UserForm = { full_name: "", email: "", password: "", role: "company_user" };

export function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [c, u] = await Promise.all([
      api.get<Company>(`/companies/${id}`),
      api.get<User[]>(`/companies/${id}/users`),
    ]);
    setCompany(c);
    setUsers(u);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post(`/companies/${id}/users`, form);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError((err as ApiError).detail ?? "Error creating user");
    } finally {
      setSubmitting(false);
    }
  }

  if (!company) return <p>Loading…</p>;

  return (
    <div>
      <p style={{ marginBottom: "0.25rem" }}>
        <Link to="/admin/companies" style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          ← Companies
        </Link>
      </p>
      <h2 style={{ marginBottom: "0.25rem" }}>{company.name}</h2>
      <p style={{ color: "#9ca3af", marginBottom: "2rem", fontSize: "0.9rem" }}>{company.slug}</p>

      <h3 style={{ marginBottom: "1rem" }}>Add user</h3>
      <form
        onSubmit={handleCreateUser}
        style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem", flexWrap: "wrap" }}
      >
        {(
          [
            { key: "full_name", placeholder: "Full name", type: "text" },
            { key: "email", placeholder: "Email", type: "email" },
            { key: "password", placeholder: "Password", type: "password" },
          ] as const
        ).map(({ key, placeholder, type }) => (
          <input
            key={key}
            type={type}
            placeholder={placeholder}
            value={form[key]}
            onChange={(e) => setField(key, e.target.value)}
            required
            style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #d1d5db", flex: 1, minWidth: 140 }}
          />
        ))}
        <select
          value={form.role}
          onChange={(e) => setField("role", e.target.value)}
          style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #d1d5db" }}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: 6,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {submitting ? "Adding…" : "Add user"}
        </button>
      </form>

      {error && <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>}

      <h3 style={{ marginBottom: "1rem" }}>Users ({users.length})</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "0.6rem 1rem" }}>Name</th>
            <th style={{ padding: "0.6rem 1rem" }}>Email</th>
            <th style={{ padding: "0.6rem 1rem" }}>Role</th>
            <th style={{ padding: "0.6rem 1rem" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "0.6rem 1rem", fontWeight: 500 }}>{u.full_name}</td>
              <td style={{ padding: "0.6rem 1rem", color: "#6b7280" }}>{u.email}</td>
              <td style={{ padding: "0.6rem 1rem" }}>{u.role.replace(/_/g, " ")}</td>
              <td style={{ padding: "0.6rem 1rem" }}>
                <span
                  style={{
                    padding: "0.2rem 0.6rem",
                    borderRadius: 999,
                    fontSize: "0.8rem",
                    background: u.is_active ? "#dcfce7" : "#fee2e2",
                    color: u.is_active ? "#166534" : "#991b1b",
                  }}
                >
                  {u.is_active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "1.5rem 1rem", color: "#9ca3af", textAlign: "center" }}>
                No users yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
