import { useEffect, useState } from "react";
import { toast } from "sonner";
import { companyService, type RadarEntryCreate } from "@/services/companyService";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { RadarEntry } from "@/types";

export function Radar() {
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
      <div>
        <h1 className="text-2xl font-bold text-ink">Radar</h1>
        <p className="mt-1 max-w-xl text-[13px] text-muted">
          Cargá las marcas y modelos que estás buscando. Cuando una agencia de la red
          publique uno que coincida —en stock, en pre-toma o en liquidación— te avisamos.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-gray-800">Radar de reposición</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-2xl bg-brand px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            + Agregar
          </button>
        </div>
        <p className="text-xs text-gray-400">Definí qué vehículos buscás. El sistema te notificará cuando haya matches.</p>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-line bg-surface p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Nueva entrada</p>
          <Input label="Marca *" required value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
          <Input label="Modelo" value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value || undefined }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Km máximo" type="number" min={0} value={form.max_km ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_km: e.target.value ? Number(e.target.value) : undefined }))} />
            <Input label="Año mínimo" type="number" min={1990} value={form.min_year ?? ""} onChange={(e) => setForm((f) => ({ ...f, min_year: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <Input label="Precio máximo $" type="number" min={0} value={form.max_price ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_price: e.target.value ? Number(e.target.value) : undefined }))} />
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-2xl mb-2">📡</p>
          <p className="text-sm font-semibold text-gray-700">Radar vacío</p>
          <p className="text-xs text-gray-400 mt-1">Añadí las marcas y modelos que te interesan.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-800">{entry.brand}{entry.model ? ` ${entry.model}` : ""}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[
                    entry.min_year ? `desde ${entry.min_year}` : null,
                    entry.max_km ? `hasta ${entry.max_km.toLocaleString("es-AR")} km` : null,
                    entry.max_price ? `hasta $${Number(entry.max_price).toLocaleString("es-AR")}` : null,
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
