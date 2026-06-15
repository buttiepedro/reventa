import { useEffect, useState } from "react";
import { toast } from "sonner";
import { catalogService, type CatalogMake, type CatalogModel, type CatalogTrim, type SyncStatus } from "@/services/catalogService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { ApiError } from "@/types";

type Tab = "makes" | "models" | "trims";

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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
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
  const [tab, setTab] = useState<Tab>("makes");

  // Makes
  const [makes, setMakes] = useState<CatalogMake[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(true);
  const [selectedMake, setSelectedMake] = useState<CatalogMake | null>(null);

  // Models
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [filterMakeId, setFilterMakeId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<CatalogModel | null>(null);

  // Trims
  const [trims, setTrims] = useState<CatalogTrim[]>([]);
  const [loadingTrims, setLoadingTrims] = useState(false);
  const [filterModelId, setFilterModelId] = useState<string>("");

  // Modals
  const [addModal, setAddModal] = useState<Tab | null>(null);
  const [editTarget, setEditTarget] = useState<{ type: Tab; id: string; name: string } | null>(null);

  // Sync
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    catalogService.getMakes()
      .then(setMakes)
      .catch(() => toast.error("Error al cargar marcas."))
      .finally(() => setLoadingMakes(false));
    catalogService.getSyncStatus().then(setSyncStatus).catch(() => {});
  }, []);

  const loadModels = async (make_id: string) => {
    setLoadingModels(true);
    try { setModels(await catalogService.getModels(make_id)); }
    catch { toast.error("Error al cargar modelos."); }
    finally { setLoadingModels(false); }
  };

  const loadTrims = async (model_id: string) => {
    setLoadingTrims(true);
    try { setTrims(await catalogService.getTrims(model_id)); }
    catch { toast.error("Error al cargar motorizaciones."); }
    finally { setLoadingTrims(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await catalogService.triggerSync();
      toast.success("Sincronización iniciada en segundo plano. Recargá en unos minutos.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al iniciar sync.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (type: Tab, id: string, name: string) => {
    if (!window.confirm(`¿Eliminar "${name}"? Se eliminarán también los modelos y motorizaciones asociados.`)) return;
    try {
      if (type === "makes") { await catalogService.deleteMake(id); setMakes((m) => m.filter((x) => x.id !== id)); }
      else if (type === "models") { await catalogService.deleteModel(id); setModels((m) => m.filter((x) => x.id !== id)); }
      else { await catalogService.deleteTrim(id); setTrims((m) => m.filter((x) => x.id !== id)); }
      toast.success("Eliminado.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al eliminar.");
    }
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de vehículos</h1>
          {syncStatus?.last_run_at && (
            <p className="text-xs text-gray-400 mt-1">
              Último sync: {new Date(syncStatus.last_run_at).toLocaleString("es-AR")}
              {" · "}{syncStatus.makes} marcas · {syncStatus.models} modelos · {syncStatus.trims} motorizaciones
            </p>
          )}
        </div>
        <Button variant="secondary" loading={syncing} onClick={handleSync}>
          Sincronizar con CarAPI
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button className={tabClass("makes")} onClick={() => setTab("makes")}>Marcas</button>
        <button className={tabClass("models")} onClick={() => setTab("models")}>Modelos</button>
        <button className={tabClass("trims")} onClick={() => setTab("trims")}>Motorizaciones</button>
      </div>

      {/* Makes tab */}
      {tab === "makes" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-gray-500">{makes.length} marcas</p>
            <Button size="sm" onClick={() => setAddModal("makes")}>+ Agregar marca</Button>
          </div>
          {loadingMakes ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {makes.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm font-medium text-gray-900">{m.name}</span>
                  <Badge tone={m.is_custom ? "blue" : "gray"}>{m.is_custom ? "Personalizado" : "CarAPI"}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setEditTarget({ type: "makes", id: m.id, name: m.name })}>Editar</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete("makes", m.id, m.name)}>Eliminar</Button>
                </div>
              ))}
              {makes.length === 0 && <p className="text-center py-12 text-gray-400 text-sm">Sin marcas. Agregá una o sincronizá con CarAPI.</p>}
            </div>
          )}
        </div>
      )}

      {/* Models tab */}
      {tab === "models" && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterMakeId}
              onChange={(e) => { setFilterMakeId(e.target.value); if (e.target.value) loadModels(e.target.value); else setModels([]); }}
            >
              <option value="">— Filtrar por marca —</option>
              {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <p className="text-sm text-gray-500 flex-1">{models.length} modelos</p>
            <Button size="sm" disabled={!filterMakeId} onClick={() => setAddModal("models")}>+ Agregar modelo</Button>
          </div>
          {loadingModels ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {models.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm font-medium text-gray-900">{m.name}</span>
                  <Badge tone={m.is_custom ? "blue" : "gray"}>{m.is_custom ? "Personalizado" : "CarAPI"}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setEditTarget({ type: "models", id: m.id, name: m.name })}>Editar</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete("models", m.id, m.name)}>Eliminar</Button>
                </div>
              ))}
              {!filterMakeId && <p className="text-center py-12 text-gray-400 text-sm">Seleccioná una marca para ver sus modelos.</p>}
              {filterMakeId && models.length === 0 && !loadingModels && <p className="text-center py-12 text-gray-400 text-sm">Sin modelos para esta marca.</p>}
            </div>
          )}
        </div>
      )}

      {/* Trims tab */}
      {tab === "trims" && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterMakeId}
              onChange={async (e) => {
                setFilterMakeId(e.target.value);
                setFilterModelId("");
                setTrims([]);
                if (e.target.value) await loadModels(e.target.value);
                else setModels([]);
              }}
            >
              <option value="">— Marca —</option>
              {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterModelId}
              disabled={!filterMakeId}
              onChange={(e) => { setFilterModelId(e.target.value); if (e.target.value) loadTrims(e.target.value); else setTrims([]); }}
            >
              <option value="">— Modelo —</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <p className="text-sm text-gray-500 flex-1">{trims.length} motorizaciones</p>
            <Button size="sm" disabled={!filterModelId} onClick={() => { setSelectedModel(models.find((m) => m.id === filterModelId) ?? null); setAddModal("trims"); }}>+ Agregar</Button>
          </div>
          {loadingTrims ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {trims.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm font-medium text-gray-900">{t.name}</span>
                  <Badge tone={t.is_custom ? "blue" : "gray"}>{t.is_custom ? "Personalizado" : "CarAPI"}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setEditTarget({ type: "trims", id: t.id, name: t.name })}>Editar</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete("trims", t.id, t.name)}>Eliminar</Button>
                </div>
              ))}
              {!filterModelId && <p className="text-center py-12 text-gray-400 text-sm">Seleccioná marca y modelo.</p>}
              {filterModelId && trims.length === 0 && !loadingTrims && <p className="text-center py-12 text-gray-400 text-sm">Sin motorizaciones para este modelo.</p>}
            </div>
          )}
        </div>
      )}

      {/* Add modal */}
      {addModal === "makes" && (
        <EditModal
          title="Nueva marca"
          initial=""
          onSave={async (name) => {
            const created = await catalogService.createMake(name);
            setMakes((m) => [...m, created].sort((a, b) => a.name.localeCompare(b.name)));
            toast.success("Marca agregada.");
          }}
          onClose={() => setAddModal(null)}
        />
      )}
      {addModal === "models" && filterMakeId && (
        <EditModal
          title={`Nuevo modelo — ${makes.find((m) => m.id === filterMakeId)?.name}`}
          initial=""
          onSave={async (name) => {
            const created = await catalogService.createModel(filterMakeId, name);
            setModels((m) => [...m, created].sort((a, b) => a.name.localeCompare(b.name)));
            toast.success("Modelo agregado.");
          }}
          onClose={() => setAddModal(null)}
        />
      )}
      {addModal === "trims" && filterModelId && (
        <EditModal
          title={`Nueva motorización — ${selectedModel?.name}`}
          initial=""
          onSave={async (name) => {
            const created = await catalogService.createTrim(filterModelId, name);
            setTrims((t) => [...t, created].sort((a, b) => a.name.localeCompare(b.name)));
            toast.success("Motorización agregada.");
          }}
          onClose={() => setAddModal(null)}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          title={`Editar ${editTarget.type === "makes" ? "marca" : editTarget.type === "models" ? "modelo" : "motorización"}`}
          initial={editTarget.name}
          onSave={async (name) => {
            if (editTarget.type === "makes") {
              await catalogService.updateMake(editTarget.id, name);
              setMakes((m) => m.map((x) => x.id === editTarget.id ? { ...x, name } : x));
            } else if (editTarget.type === "models") {
              await catalogService.updateModel(editTarget.id, filterMakeId, name);
              setModels((m) => m.map((x) => x.id === editTarget.id ? { ...x, name } : x));
            } else {
              await catalogService.updateTrim(editTarget.id, filterModelId, name);
              setTrims((t) => t.map((x) => x.id === editTarget.id ? { ...x, name } : x));
            }
            toast.success("Actualizado.");
          }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
