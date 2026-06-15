import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/services/api";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import type { ApiError, Company, User } from "@/types";

const ROLE_OPTIONS = [
  { value: "company_user", label: "Usuario" },
  { value: "company_admin", label: "Admin" },
];

interface CreateForm { full_name: string; email: string; password: string; role: string; }
interface EditForm { full_name: string; role: string; is_active: boolean; }

const EMPTY_CREATE: CreateForm = { full_name: "", email: "", password: "", role: "company_user" };

export function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ full_name: "", role: "company_user", is_active: true });
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([
        api.get<Company>(`/companies/${id}`),
        api.get<User[]>(`/companies/${id}/users`),
      ]);
      setCompany(c);
      setUsers(u);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/companies/${id}/users`, form);
      setForm(EMPTY_CREATE);
      await load();
      toast.success("Usuario creado.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al crear el usuario");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(u: User) {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name, role: u.role, is_active: u.is_active });
  }

  async function handleEditUser(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await api.put(`/users/${editTarget.id}`, editForm);
      setEditTarget(null);
      await load();
      toast.success("Usuario actualizado.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al actualizar");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteUser(u: User) {
    if (!window.confirm(`¿Eliminar a ${u.full_name}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success("Usuario eliminado.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al eliminar");
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;
  if (!company) return null;

  return (
    <div className="pb-10">
      <div className="mb-6">
        <Link to="/admin/companies" className="text-sm text-gray-500 hover:text-gray-700">
          ← Empresas
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{company.name}</h1>
        <p className="text-sm text-gray-400">{company.slug} · <Badge tone={company.is_active ? "green" : "red"}>{company.is_active ? "Activa" : "Inactiva"}</Badge></p>
      </div>

      {/* Create user form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Agregar usuario</h2>
        <form onSubmit={handleCreateUser} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-36">
            <Input placeholder="Nombre completo" value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div className="flex-1 min-w-36">
            <Input type="email" placeholder="Email" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="flex-1 min-w-36">
            <Input type="password" placeholder="Contraseña" value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className="min-w-32">
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <Button type="submit" loading={submitting}>Agregar</Button>
        </form>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Usuarios ({users.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{u.role.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  <Badge tone={u.is_active ? "green" : "red"}>
                    {u.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>Editar</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteUser(u)}>Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No hay usuarios todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar usuario">
        <form onSubmit={handleEditUser} className="flex flex-col gap-4">
          <Input label="Nombre completo" value={editForm.full_name}
            onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} required />
          <Select label="Rol" value={editForm.role}
            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Usuario activo</span>
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
