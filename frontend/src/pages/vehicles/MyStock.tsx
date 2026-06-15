import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { vehicleService } from "@/services/vehicleService";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { VehicleListItem, VehicleStatus } from "@/types/vehicle";

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
};

const STATUS_TONE: Record<string, "green" | "yellow" | "red"> = {
  available: "green",
  reserved: "yellow",
  sold: "red",
};

const STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Reservado" },
  { value: "sold", label: "Vendido" },
];

export function MyStock() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setVehicles(await vehicleService.listMy());
    } catch {
      toast.error("Error al cargar tu stock.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
      toast.success("Estado actualizado.");
    } catch {
      toast.error("Error al cambiar el estado.");
    }
  };

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi stock</h1>
        <Link to="/vehicles/new">
          <Button>+ Nuevo vehículo</Button>
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center py-24"><Spinner /></div>
      )}

      {!loading && vehicles.length === 0 && (
        <div className="text-center py-24 text-gray-400">
          Todavía no tenés vehículos.{" "}
          <Link to="/vehicles/new" className="text-blue-600 hover:underline">Agregá el primero.</Link>
        </div>
      )}

      {!loading && vehicles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {vehicles.map((v) => (
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
                {STATUS_LABELS[v.status]}
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
      )}
    </div>
  );
}
