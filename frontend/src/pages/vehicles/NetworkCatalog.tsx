import { useCallback, useEffect, useState } from "react";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { FilterBar } from "@/components/vehicles/FilterBar";
import { Spinner } from "@/components/ui/Spinner";
import { vehicleService } from "@/services/vehicleService";
import type { PaginatedResponse, VehicleFilters, VehicleListItem } from "@/types/vehicle";

export function NetworkCatalog() {
  const [result, setResult] = useState<PaginatedResponse<VehicleListItem> | null>(null);
  const [filters, setFilters] = useState<VehicleFilters>({ page: 1, page_size: 20, status: "available" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: VehicleFilters) => {
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

  useEffect(() => { load(filters); }, [filters, load]);

  return (
    <div className="pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Red de vehículos</h1>
        <p className="text-sm text-gray-500 mt-1">Los vehículos de tus favoritas aparecen primero.</p>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      {loading && (
        <div className="flex justify-center items-center py-24">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="text-red-600 bg-red-50 rounded-lg p-4">{error}</div>
      )}

      {!loading && result && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {result.total} vehículo{result.total !== 1 ? "s" : ""}
          </p>

          {result.items.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              No hay vehículos que coincidan con los filtros.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {result.items.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          )}

          {result.pages > 1 && (
            <div className="flex gap-2 justify-center mt-10">
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilters((f) => ({ ...f, page: p }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    p === result.page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
