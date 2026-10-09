import { useEffect, useState } from "react";
import { toast } from "sonner";
import { catalogService, type CatalogMake, type SyncStatus } from "@/services/catalogService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { ApiError } from "@/types";

function EditModal({ title, initial, onSave, onClose }: {
  title: string;
  initial: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-ink mb-4">{title}</h3>
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex gap-2 mt-4">
          <Button loading={saving} onClick={async () => {
            if (!name.trim()) return;
            setSaving(true);
            try { await onSave(name.trim()); onClose(); }
            catch (err) { toast.error((err as ApiError).detail ?? "Error"); setSaving(false); }
          }}>Guardar</Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

export function Catalog() {
  const [makes, setMakes] = useState<CatalogMake[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editTarget, setEditTarget] = useState<CatalogMake | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    catalogService.getMakes()
      .then(setMakes)
      .catch(() => toast.error("Error al cargar marcas."))
      .finally(() => setLoading(false));
    catalogService.getSyncStatus().then(setSyncStatus).catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await catalogService.triggerSync();
      toast.success("Sincronización iniciada. Recargá en unos segundos.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al iniciar la sincronización.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (make: CatalogMake) => {
    if (!window.confirm(`¿Eliminar la marca "${make.name}"?`)) return;
    try {
      await catalogService.deleteMake(make.id);
      setMakes((m) => m.filter((x) => x.id !== make.id));
      toast.success("Marca eliminada.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al eliminar.");
    }
  };

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Marcas de vehículos</h1>
          <p className="text-[13px] text-muted mt-1 max-w-xl">
            Las marcas son una lista cerrada que se sincroniza desde Mercado Libre; en el
            formulario de carga se puede elegir «Otro». El modelo y la motorización son
            texto libre y no se administran acá.
          </p>
          {syncStatus?.last_run_at && (
            <p className="text-xs text-faint mt-1.5">
              Última sincronización: {new Date(syncStatus.last_run_at).toLocaleString("es-AR")}
              {" · "}{syncStatus.makes} marcas nuevas
            </p>
          )}
          {syncStatus?.errors?.length ? (
            <ul className="mt-2 space-y-1">
              {syncStatus.errors.map((e, i) => (
                <li key={i} className="text-xs text-red-600">{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <Button variant="secondary" loading={syncing} onClick={handleSync}>
          Sincronizar con Mercado Libre
        </Button>
      </div>

      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted">{makes.length} marcas</p>
        <Button size="sm" onClick={() => setAdding(true)}>+ Agregar marca</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="bg-surface rounded-xl border border-line shadow-sm divide-y divide-line-soft">
          {makes.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 text-sm font-medium text-ink">{m.name}</span>
              <Badge tone={m.is_custom ? "blue" : "gray"}>
                {m.is_custom ? "Agregada a mano" : "Mercado Libre"}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setEditTarget(m)}>Editar</Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(m)}>Eliminar</Button>
            </div>
          ))}
          {makes.length === 0 && (
            <p className="text-center py-12 text-faint text-sm">
              Sin marcas. Agregá una o sincronizá con Mercado Libre.
            </p>
          )}
        </div>
      )}

      {adding && (
        <EditModal
          title="Nueva marca"
          initial=""
          onSave={async (name) => {
            const created = await catalogService.createMake(name);
            setMakes((m) => [...m, created].sort((a, b) => a.name.localeCompare(b.name)));
            toast.success("Marca agregada.");
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {editTarget && (
        <EditModal
          title="Editar marca"
          initial={editTarget.name}
          onSave={async (name) => {
            await catalogService.updateMake(editTarget.id, name);
            setMakes((m) => m.map((x) => (x.id === editTarget.id ? { ...x, name } : x)));
            toast.success("Marca actualizada.");
          }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
