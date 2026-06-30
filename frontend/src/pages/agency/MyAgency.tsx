import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { companyService, type CompanyProfileUpdate, type RadarEntryCreate } from "@/services/companyService";
import { favoriteService, type FavoriteRequest } from "@/services/favoriteService";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import type { Company, CompanyProfile, RadarEntry } from "@/types";

type Tab = "perfil" | "conexiones" | "radar";

// ─── Tab Toggle ──────────────────────────────────────────────

function TabToggle({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "perfil", label: "Perfil" },
    { id: "conexiones", label: "Conexiones" },
    { id: "radar", label: "Radar" },
  ];
  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            active === t.id ? "bg-green-600 text-white" : "bg-white text-gray-500 border border-gray-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────

function ProfileTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CompanyProfileUpdate>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    companyService.getMyProfile()
      .then((p) => { setProfile(p); setForm({ name: p.name, cuit: p.cuit ?? "", phone: p.phone ?? "", description: p.description ?? "", address_text: p.address_text ?? "", lat: p.lat ?? undefined, lng: p.lng ?? undefined }); })
      .catch(() => toast.error("No se pudo cargar el perfil."));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: CompanyProfileUpdate = {};
      if (form.name) payload.name = form.name;
      if (form.cuit !== undefined) payload.cuit = form.cuit || undefined;
      if (form.phone !== undefined) payload.phone = form.phone || undefined;
      if (form.description !== undefined) payload.description = form.description || undefined;
      if (form.address_text !== undefined) payload.address_text = form.address_text || undefined;
      if (form.lat !== undefined) payload.lat = form.lat;
      if (form.lng !== undefined) payload.lng = form.lng;
      const updated = await companyService.updateMyProfile(payload);
      setProfile(updated);
      setEditing(false);
      toast.success("Perfil actualizado.");
    } catch {
      toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (!editing) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        {!profile.cuit && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <strong>Completá tu perfil:</strong> sin CUIT verificado, algunas funciones estarán limitadas.
          </div>
        )}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
            <p className="text-xs text-gray-400">@{profile.slug}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-green-600 font-semibold hover:underline"
          >
            Editar
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="CUIT" value={profile.cuit} />
          <Field label="Teléfono" value={profile.phone} />
          <Field label="Dirección" value={profile.address_text} className="col-span-2" />
          <Field label="Lat" value={profile.lat?.toString()} />
          <Field label="Lng" value={profile.lng?.toString()} />
        </div>
        {profile.description && (
          <p className="text-sm text-gray-600 border-t border-gray-100 pt-3">{profile.description}</p>
        )}
        {profile.avg_rating && (
          <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
            <span className="text-yellow-500 font-bold">★ {Number(profile.avg_rating).toFixed(1)}</span>
            <span className="text-xs text-gray-400">({profile.total_ratings} valoraciones)</span>
          </div>
        )}
        <div className="border-t border-gray-100 pt-3">
          <Link to="/vehicles/my" className="text-sm text-green-600 font-semibold hover:underline">
            → Ver mi stock
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      <h2 className="text-base font-bold text-gray-900">Editar perfil</h2>
      <Input label="Nombre de agencia" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <Input label="CUIT" value={form.cuit ?? ""} onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))} placeholder="20-12345678-9" />
      <Input label="Teléfono / WhatsApp" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+54 9 11 1234-5678" />
      <Input label="Dirección" value={form.address_text ?? ""} onChange={(e) => setForm((f) => ({ ...f, address_text: e.target.value }))} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Latitud" type="number" step="any" value={form.lat ?? ""} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value ? Number(e.target.value) : undefined }))} placeholder="-34.6037" />
        <Input label="Longitud" type="number" step="any" value={form.lng ?? ""} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value ? Number(e.target.value) : undefined }))} placeholder="-58.3816" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Descripción</label>
        <textarea
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button onClick={() => setEditing(false)} className="px-4 py-2 text-gray-500 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

// ─── Conexiones Tab ──────────────────────────────────────────

function ConexionesTab() {
  const [confirmed, setConfirmed] = useState<Company[]>([]);
  const [incoming, setIncoming] = useState<FavoriteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [c, i] = await Promise.all([
        favoriteService.getConfirmed(),
        favoriteService.getIncomingRequests(),
      ]);
      setConfirmed(c);
      setIncoming(i);
    } catch {
      toast.error("Error al cargar conexiones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleAccept = async (id: string) => {
    await favoriteService.acceptRequest(id).catch(() => toast.error("Error"));
    reload();
    toast.success("Conexión aceptada.");
  };

  const handleRemove = async (id: string) => {
    await favoriteService.remove(id).catch(() => toast.error("Error"));
    reload();
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {incoming.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-amber-50">
            <p className="text-xs font-semibold text-amber-700">Solicitudes pendientes ({incoming.length})</p>
          </div>
          {incoming.map((r) => (
            <div key={r.requester_id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-800">{r.requester_name}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(r.requester_id)}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded-full font-semibold"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => handleRemove(r.requester_id)}
                  className="text-xs px-3 py-1 border border-gray-200 text-gray-500 rounded-full"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Conectadas ({confirmed.length})</p>
        </div>
        {confirmed.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-400">Sin conexiones aún. Buscá agencias en el Mercado y enviá solicitudes.</p>
          </div>
        ) : (
          confirmed.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-800">{c.name}</p>
              <button
                onClick={() => handleRemove(c.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Desconectar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Radar Tab ───────────────────────────────────────────────

function RadarTab() {
  const [entries, setEntries] = useState<RadarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RadarEntryCreate>({ brand: "" });
  const [saving, setSaving] = useState(false);

  const reload = () =>
    companyService.listRadar()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { reload(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await companyService.createRadarEntry(form);
      setForm({ brand: "" });
      setShowForm(false);
      reload();
      toast.success("Entrada añadida al radar.");
    } catch {
      toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await companyService.deleteRadarEntry(id).catch(() => toast.error("Error"));
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-gray-800">Radar de reposición</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1 bg-green-600 text-white rounded-full font-semibold"
          >
            + Agregar
          </button>
        </div>
        <p className="text-xs text-gray-400">Definí qué vehículos buscás. El sistema te notificará cuando haya matches.</p>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Nueva entrada</p>
          <Input label="Marca *" required value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
          <Input label="Modelo" value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value || undefined }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Km máximo" type="number" min={0} value={form.max_km ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_km: e.target.value ? Number(e.target.value) : undefined }))} />
            <Input label="Año mínimo" type="number" min={1990} value={form.min_year ?? ""} onChange={(e) => setForm((f) => ({ ...f, min_year: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <Input label="Precio máximo $" type="number" min={0} value={form.max_price ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_price: e.target.value ? Number(e.target.value) : undefined }))} />
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-2xl mb-2">📡</p>
          <p className="text-sm font-semibold text-gray-700">Radar vacío</p>
          <p className="text-xs text-gray-400 mt-1">Añadí las marcas y modelos que te interesan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-800">{entry.brand}{entry.model ? ` ${entry.model}` : ""}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[
                    entry.min_year ? `desde ${entry.min_year}` : null,
                    entry.max_km ? `hasta ${entry.max_km.toLocaleString()} km` : null,
                    entry.max_price ? `hasta $${Number(entry.max_price).toLocaleString()}` : null,
                  ].filter(Boolean).join(" · ") || "Sin filtros adicionales"}
                </p>
              </div>
              <button onClick={() => handleDelete(entry.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-3 mt-0.5">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────

export function MyAgency() {
  const [tab, setTab] = useState<Tab>("perfil");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Mi Agencia</h1>
      <TabToggle active={tab} onChange={setTab} />
      {tab === "perfil" && <ProfileTab />}
      {tab === "conexiones" && <ConexionesTab />}
      {tab === "radar" && <RadarTab />}
    </div>
  );
}
