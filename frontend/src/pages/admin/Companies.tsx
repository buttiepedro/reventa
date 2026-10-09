import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/services/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { companyService } from "@/services/companyService";
import type { ApiError, CompanyAdmin } from "@/types";

export function Companies() {
  const [companies, setCompanies] = useState<CompanyAdmin[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<CompanyAdmin | null>(null);

  // Revisión de CUIT
  const [rejectTarget, setRejectTarget] = useState<CompanyAdmin | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const loadCompanies = useCallback(async () => {
    try {
      const data = await companyService.adminList();
      setCompanies(data);
    } catch (err) {
      setError(`Error al cargar las empresas: ${(err as ApiError).detail ?? "desconocido"}`);
    }
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/companies", { name, slug });
      setName("");
      setSlug("");
      await loadCompanies();
      toast.success("Empresa creada.");
    } catch (err) {
      setError((err as ApiError).detail ?? "Error al crear la empresa");
    } finally {
      setSubmitting(false);
    }
  }

  async function review(c: CompanyAdmin, approved: boolean, reason?: string) {
    setReviewing(c.id);
    try {
      await companyService.verifyCuit(c.id, approved, reason);
      toast.success(approved ? `CUIT de ${c.name} verificado.` : `CUIT de ${c.name} rechazado.`);
      setRejectTarget(null);
      setRejectReason("");
      await loadCompanies();
    } catch (err) {
      toast.error((err as ApiError).detail ?? "No se pudo registrar la revisión.");
    } finally {
      setReviewing(null);
    }
  }

  function openEdit(c: CompanyAdmin) {
    setEditTarget(c);
    setEditName(c.name);
    setEditActive(c.is_active);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await api.put(`/companies/${editTarget.id}`, { name: editName, is_active: editActive });
      setEditTarget(null);
      await loadCompanies();
      toast.success("Empresa actualizada.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al actualizar");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(c: CompanyAdmin) {
    if (!window.confirm(`¿Eliminar la empresa "${c.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/companies/${c.id}`);
      setCompanies((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("Empresa eliminada.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al eliminar");
    }
  }

  return (
    <div className="pb-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Empresas</h1>

      {/* Create form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Nueva empresa</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-40">
            <Input placeholder="slug (ej: acme-corp)" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </div>
          <Button type="submit" loading={submitting}>Agregar</Button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">CUIT</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.slug}</td>
                <td className="px-4 py-3">
                  <Badge tone={c.is_active ? "green" : "red"}>
                    {c.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {!c.cuit ? (
                    <span className="text-gray-300">sin enviar</span>
                  ) : c.cuit_verified ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="green">Verificado</Badge>
                      <span className="font-mono text-xs text-gray-500">{c.cuit}</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-gray-700">{c.cuit}</span>
                      {c.cuit_review_notes ? (
                        <Badge tone="red">Rechazado</Badge>
                      ) : (
                        <Badge tone="yellow">Pendiente</Badge>
                      )}
                      <Button size="sm" loading={reviewing === c.id} onClick={() => review(c, true)}>
                        Verificar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setRejectTarget(c)}>
                        Rechazar
                      </Button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <Link to={`/admin/companies/${c.id}`}>
                      <Button variant="ghost" size="sm">Usuarios</Button>
                    </Link>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(c)}>Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No hay empresas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rechazo de CUIT */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Rechazar CUIT">
        <form
          onSubmit={(e) => { e.preventDefault(); if (rejectTarget) review(rejectTarget, false, rejectReason); }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-gray-500">
            {rejectTarget?.name} · <span className="font-mono">{rejectTarget?.cuit}</span>
          </p>
          <Input
            label="Motivo"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="No coincide con la razón social"
            required
          />
          <p className="text-xs text-gray-400">
            El motivo le llega a la agencia como notificación para que lo corrija.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="danger" loading={reviewing === rejectTarget?.id}>
              Rechazar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRejectTarget(null)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar empresa">
        <form onSubmit={handleEdit} className="flex flex-col gap-4">
          <Input label="Nombre" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Empresa activa</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={editSaving}>Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
