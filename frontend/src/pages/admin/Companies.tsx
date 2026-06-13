import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { api } from "@/services/api";
import type { ApiError, Company } from "@/types";

export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadCompanies = useCallback(async () => {
    const data = await api.get<Company[]>("/companies");
    setCompanies(data);
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/companies", { name, slug });
      setName("");
      setSlug("");
      await loadCompanies();
    } catch (err) {
      setError((err as ApiError).detail ?? "Error creating company");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: "1.5rem" }}>Companies</h2>

      <form
        onSubmit={handleCreate}
        style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}
      >
        <input
          placeholder="Company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #d1d5db", flex: 1 }}
        />
        <input
          placeholder="slug (e.g. acme-corp)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #d1d5db", flex: 1 }}
        />
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
          {submitting ? "Adding…" : "Add company"}
        </button>
      </form>

      {error && <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "0.6rem 1rem" }}>Name</th>
            <th style={{ padding: "0.6rem 1rem" }}>Slug</th>
            <th style={{ padding: "0.6rem 1rem" }}>Status</th>
            <th style={{ padding: "0.6rem 1rem" }}></th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "0.6rem 1rem", fontWeight: 500 }}>{c.name}</td>
              <td style={{ padding: "0.6rem 1rem", color: "#6b7280" }}>{c.slug}</td>
              <td style={{ padding: "0.6rem 1rem" }}>
                <span
                  style={{
                    padding: "0.2rem 0.6rem",
                    borderRadius: 999,
                    fontSize: "0.8rem",
                    background: c.is_active ? "#dcfce7" : "#fee2e2",
                    color: c.is_active ? "#166534" : "#991b1b",
                  }}
                >
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td style={{ padding: "0.6rem 1rem" }}>
                <Link to={`/admin/companies/${c.id}`} style={{ color: "#2563eb" }}>
                  Manage →
                </Link>
              </td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "1.5rem 1rem", color: "#9ca3af", textAlign: "center" }}>
                No companies yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
