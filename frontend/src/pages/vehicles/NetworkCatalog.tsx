import { useCallback, useEffect, useState } from "react";
import { VehicleCard } from "../../components/vehicles/VehicleCard";
import { FilterBar } from "../../components/vehicles/FilterBar";
import { vehicleService } from "../../services/vehicleService";
import type { PaginatedResponse, VehicleFilters, VehicleListItem } from "../../types/vehicle";

export function NetworkCatalog() {
  const [result, setResult] = useState<PaginatedResponse<VehicleListItem> | null>(null);
  const [filters, setFilters] = useState<VehicleFilters>({ page: 1, page_size: 20, status: "available" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: VehicleFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.listNetwork(f);
      setResult(data);
    } catch {
      setError("Error al cargar los vehículos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  const handlePageChange = (page: number) => setFilters((f) => ({ ...f, page }));

  return (
    <div style={{ padding: "0 0 40px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Red de vehículos</h2>
      <p style={{ color: "#6b7280", marginBottom: 12, fontSize: 14 }}>
        Los vehículos de tus concesionarias favoritas aparecen primero.
      </p>

      <FilterBar filters={filters} onChange={setFilters} />

      {loading && <div style={{ padding: "40px 0", textAlign: "center", color: "#6b7280" }}>Cargando...</div>}
      {error && <div style={{ padding: "20px 0", color: "#dc2626" }}>{error}</div>}

      {!loading && result && (
        <>
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
            {result.total} vehículo{result.total !== 1 ? "s" : ""}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 20,
            }}
          >
            {result.items.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>

          {result.pages > 1 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 32 }}>
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    background: p === result.page ? "#2563eb" : "#fff",
                    color: p === result.page ? "#fff" : "#374151",
                    cursor: "pointer",
                    fontWeight: p === result.page ? 700 : 400,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {result.items.length === 0 && (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: "60px 0" }}>
              No hay vehículos que coincidan con los filtros.
            </div>
          )}
        </>
      )}
    </div>
  );
}
