import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { vehicleService } from "@/services/vehicleService";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { VehicleListItem } from "@/types/vehicle";

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Nafta", diesel: "Diésel", electric: "Eléctrico", hybrid: "Híbrido", gnc: "GNC",
};
const TRANS_LABELS: Record<string, string> = {
  manual: "Manual", automatic: "Automático",
};

export function PreTomaFeed() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [interested, setInterested] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const list = await vehicleService.listPreToma();
      setVehicles(list);
    } catch {
      toast.error("Error al cargar las pre tomas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleInterest = async (id: string) => {
    setWorking((s) => new Set([...s, id]));
    try {
      if (interested.has(id)) {
        await vehicleService.removeInterest(id);
        setInterested((s) => { const n = new Set(s); n.delete(id); return n; });
        toast.success("Interés quitado.");
      } else {
        await vehicleService.addInterest(id);
        setInterested((s) => new Set([...s, id]));
        toast.success("¡Interés registrado! La concesionaria fue notificada.");
      }
    } catch (err: unknown) {
      toast.error((err as { detail?: string })?.detail ?? "Error al registrar interés.");
    } finally {
      setWorking((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  return (
    <div className="pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pre Tomas disponibles</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vehículos en pre toma de concesionarias con las que estás conectado. Si te interesa, avisales.
        </p>
      </div>

      {loading && <div className="flex justify-center py-24"><Spinner /></div>}

      {!loading && vehicles.length === 0 && (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg font-medium mb-2">Sin pre tomas disponibles</p>
          <p className="text-sm">
            Las pre tomas de tus concesionarias conectadas aparecen acá.
          </p>
        </div>
      )}

      {!loading && vehicles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="h-40 bg-gray-100 relative">
                {v.primary_image_url ? (
                  <img src={v.primary_image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-gray-400">Sin foto</div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge tone="purple">Pre Toma</Badge>
                </div>
              </div>

              <div className="p-4 flex flex-col flex-1 gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">{v.brand} {v.model} {v.year}</h3>
                  {v.version && <p className="text-xs text-gray-500">{v.version}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{v.company_name}</p>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs text-gray-600">
                  <span className="bg-gray-100 rounded px-1.5 py-0.5">{v.mileage.toLocaleString()} km</span>
                  <span className="bg-gray-100 rounded px-1.5 py-0.5">{FUEL_LABELS[v.fuel_type] ?? v.fuel_type}</span>
                  <span className="bg-gray-100 rounded px-1.5 py-0.5">{TRANS_LABELS[v.transmission] ?? v.transmission}</span>
                </div>

                <div className="mt-auto flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/vehicles/${v.id}`)}
                  >
                    Ver detalle
                  </Button>
                  <Button
                    size="sm"
                    variant={interested.has(v.id) ? "secondary" : "primary"}
                    loading={working.has(v.id)}
                    onClick={() => toggleInterest(v.id)}
                  >
                    {interested.has(v.id) ? "Ya no me interesa" : "Me interesa"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
