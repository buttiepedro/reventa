import { useCallback, useEffect, useState } from "react";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { FilterBar } from "@/components/vehicles/FilterBar";
import { Spinner } from "@/components/ui/Spinner";
import { vehicleService } from "@/services/vehicleService";
import type { PaginatedResponse, VehicleFilters, VehicleListItem } from "@/types/vehicle";

type Tab = "stock" | "pre_toma" | "liquidaciones";

function TabToggle({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "stock", label: "Stock" },
    { id: "pre_toma", label: "Pre-Tomas (24hs)" },
    { id: "liquidaciones", label: "Liquidaciones (72hs)" },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            active === t.id
              ? "bg-green-600 text-white shadow-sm"
              : "bg-white text-gray-500 border border-gray-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function PreTomaFeedTab() {
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vehicleService.listPreToma()
      .then(setVehicles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (vehicles.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center shadow-sm">
        <p className="text-3xl mb-2">🚗</p>
        <p className="text-sm font-semibold text-gray-700">Sin pre-tomas activas</p>
        <p className="text-xs text-gray-400 mt-1">Las pre-tomas de tus favoritas confirmadas aparecerán acá.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vehicles.map((v) => (
        <VehicleCard key={v.id} vehicle={v} showPreTomaActions />
      ))}
    </div>
  );
}

function LiquidacionesTab() {
  return (
    <div className="bg-white rounded-xl p-8 text-center shadow-sm">
      <p className="text-3xl mb-2">🏗️</p>
      <p className="text-sm font-semibold text-gray-700">Próximamente</p>
      <p className="text-xs text-gray-400 mt-1">Stock a precio de liquidación con timer de 72hs.</p>
    </div>
  );
}

export function Mercado() {
  const [tab, setTab] = useState<Tab>("stock");
  const [result, setResult] = useState<PaginatedResponse<VehicleListItem> | null>(null);
  const [filters, setFilters] = useState<VehicleFilters>({ page: 1, page_size: 20, status: "available" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStock = useCallback(async (f: VehicleFilters) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await vehicleService.listNetwork(f));
    } catch {
      setError("Error al cargar los vehículos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "stock") loadStock(filters);
  }, [tab, filters, loadStock]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Mercado</h1>

      <TabToggle active={tab} onChange={setTab} />

      {tab === "stock" && (
        <>
          <FilterBar filters={filters} onChange={setFilters} />
          {loading && <div className="flex justify-center py-16"><Spinner /></div>}
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          {!loading && !error && result && (
            <>
              {result.items.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="text-sm font-semibold text-gray-700">Sin resultados</p>
                  <p className="text-xs text-gray-400 mt-1">Probá con otros filtros.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.items.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === "pre_toma" && <PreTomaFeedTab />}
      {tab === "liquidaciones" && <LiquidacionesTab />}
    </div>
  );
}
