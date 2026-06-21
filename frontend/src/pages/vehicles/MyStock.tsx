import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { vehicleService } from "@/services/vehicleService";
import { sheetService, type SyncResult } from "@/services/sheetService";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { VehicleListItem, VehicleStatus } from "@/types/vehicle";
import type { ApiError } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
  pre_toma: "Pre Toma",
};

const STATUS_TONE: Record<string, "green" | "yellow" | "red" | "purple" | "gray"> = {
  available: "green",
  reserved: "yellow",
  sold: "red",
  pre_toma: "purple",
};

const STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Reservado" },
  { value: "sold", label: "Vendido" },
  { value: "pre_toma", label: "Pre Toma" },
];

interface Interest { company_id: string; company_name: string; created_at: string }

export function MyStock() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSheet, setHasSheet] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [interestsModal, setInterestsModal] = useState<{ vehicleId: string; label: string } | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [vehicleList, sheetConfig] = await Promise.all([
        vehicleService.listMy(),
        sheetService.getConfig().catch(() => null),
      ]);
      setVehicles(vehicleList);
      setHasSheet(!!sheetConfig);
    } catch {
      toast.error("Error al cargar tu stock.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      const result: SyncResult = await sheetService.sync();
      const parts = [];
      if (result.created) parts.push(`${result.created} creados`);
      if (result.updated) parts.push(`${result.updated} actualizados`);
      if (result.skipped) parts.push(`${result.skipped} omitidos`);
      if (result.errors.length === 0) {
        toast.success(`Sincronización completa: ${parts.join(" · ") || "sin cambios"}`);
      } else {
        toast.warning(`Sincronización con ${result.errors.length} error(es). ${parts.join(" · ")}`);
      }
      load();
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este vehículo?")) return;
    try {
      await vehicleService.delete(id);
      setVehicles((vs) => vs.filter((v) => v.id !== id));
      toast.success("Vehículo eliminado.");
    } catch {
      toast.error("Error al eliminar el vehículo.");
    }
  };

  const handleStatusChange = async (id: string, status: VehicleStatus) => {
    try {
      const updated = await vehicleService.updateStatus(id, status);
      setVehicles((vs) => vs.map((v) => v.id === id ? { ...v, status: updated.status } : v));
      if (status === "pre_toma") {
        toast.success("Vehículo en Pre Toma. Tus concesionarias conectadas serán notificadas.");
      } else if (status === "available") {
        toast.success("Vehículo publicado en la red.");
      } else {
        toast.success("Estado actualizado.");
      }
    } catch {
      toast.error("Error al cambiar el estado.");
    }
  };

  const openInterests = async (v: VehicleListItem) => {
    setInterestsModal({ vehicleId: v.id, label: `${v.brand} ${v.model} ${v.year}` });
    setLoadingInterests(true);
    try {
      const list = await vehicleService.listInterests(v.id);
      setInterests(list);
    } catch {
      toast.error("Error al cargar los interesados.");
    } finally {
      setLoadingInterests(false);
    }
  };

  const handlePublish = async (id: string) => {
    await handleStatusChange(id, "available");
    setInterestsModal(null);
  };

  const preTomaVehicles = vehicles.filter((v) => v.status === "pre_toma");
  const regularVehicles = vehicles.filter((v) => v.status !== "pre_toma");

  return (
    <div className="pb-10">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi stock</h1>
        <div className="flex gap-2">
          {hasSheet && (
            <Button variant="secondary" loading={syncing} onClick={handleQuickSync}>
              Sincronizar hoja
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate("/vehicles/sheet-sync")}>
            {hasSheet ? "Configurar hoja" : "Vincular hoja"}
          </Button>
          <Link to="/vehicles/new">
            <Button>+ Nuevo vehículo</Button>
          </Link>
        </div>
      </div>

      {loading && <div className="flex justify-center py-24"><Spinner /></div>}

      {!loading && vehicles.length === 0 && (
        <div className="text-center py-24 text-gray-400">
          Todavía no tenés vehículos.{" "}
          <Link to="/vehicles/new" className="text-blue-600 hover:underline">Agregá el primero.</Link>
        </div>
      )}

      {!loading && preTomaVehicles.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            Pre Tomas
            <Badge tone="purple">{preTomaVehicles.length}</Badge>
          </h2>
          <div className="bg-white rounded-xl border border-purple-100 shadow-sm divide-y divide-gray-50">
            {preTomaVehicles.map((v) => (
              <div key={v.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                  {v.primary_image_url
                    ? <img src={v.primary_image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <div className="flex items-center justify-center h-full text-xs text-gray-400">Sin img</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{v.brand} {v.model} {v.year}</p>
                  <p className="text-sm text-gray-500">{v.mileage.toLocaleString()} km · ${Number(v.price_resale).toLocaleString()}</p>
                </div>
                <Badge tone="purple">Pre Toma</Badge>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => openInterests(v)}>Ver interesados</Button>
                  <Button size="sm" onClick={() => handleStatusChange(v.id, "available")}>Publicar en red</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/vehicles/${v.id}/edit`)}>Editar</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(v.id)}>Eliminar</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && regularVehicles.length > 0 && (
        <div>
          {preTomaVehicles.length > 0 && (
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Stock activo</h2>
          )}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {regularVehicles.map((v) => (
              <div key={v.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                  {v.primary_image_url
                    ? <img src={v.primary_image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <div className="flex items-center justify-center h-full text-xs text-gray-400">Sin img</div>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{v.brand} {v.model} {v.year}</p>
                  <p className="text-sm text-gray-500">{v.mileage.toLocaleString()} km · ${Number(v.price_resale).toLocaleString()}</p>
                </div>

                <Badge tone={STATUS_TONE[v.status] ?? "gray"} className="hidden sm:inline-flex">
                  {STATUS_LABELS[v.status] ?? v.status}
                </Badge>

                <select
                  value={v.status}
                  onChange={(e) => handleStatusChange(v.id, e.target.value as VehicleStatus)}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/vehicles/${v.id}`)}>Ver</Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/vehicles/${v.id}/edit`)}>Editar</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(v.id)}>Eliminar</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interests modal */}
      {interestsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Interesados en Pre Toma</h3>
                <p className="text-sm text-gray-500">{interestsModal.label}</p>
              </div>
              <button onClick={() => setInterestsModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-6 py-4 min-h-[80px]">
              {loadingInterests && <div className="flex justify-center py-4"><Spinner /></div>}
              {!loadingInterests && interests.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nadie ha marcado interés todavía.</p>
              )}
              {!loadingInterests && interests.length > 0 && (
                <ul className="divide-y divide-gray-50">
                  {interests.map((i) => (
                    <li key={i.company_id} className="py-2.5 flex items-center justify-between">
                      <span className="font-medium text-gray-800">{i.company_name}</span>
                      <span className="text-xs text-gray-400">{new Date(i.created_at).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
              <Button variant="secondary" onClick={() => setInterestsModal(null)}>Cerrar</Button>
              <Button onClick={() => handlePublish(interestsModal.vehicleId)}>Publicar en red</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
