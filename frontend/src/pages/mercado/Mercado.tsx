import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { FilterBar } from "@/components/vehicles/FilterBar";
import { Spinner } from "@/components/ui/Spinner";
import { vehicleService } from "@/services/vehicleService";
import type { PaginatedResponse, VehicleFilters, VehicleListItem } from "@/types/vehicle";

const GEO_CACHE_KEY = "mercado_geo";
const GEO_TTL_MS = 60 * 60 * 1000; // 1 hour

interface GeoCache { lat: number; lng: number; ts: number }

function loadGeoCache(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed: GeoCache = JSON.parse(raw);
    if (Date.now() - parsed.ts > GEO_TTL_MS) { localStorage.removeItem(GEO_CACHE_KEY); return null; }
    return { lat: parsed.lat, lng: parsed.lng };
  } catch { return null; }
}

function saveGeoCache(lat: number, lng: number) {
  localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
}

const RADIUS_OPTIONS: { label: string; value: number | null }[] = [
  { label: "50 km", value: 50 },
  { label: "100 km", value: 100 },
  { label: "200 km", value: 200 },
  { label: "Todo el país", value: null },
];

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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(loadGeoCache);
  const [activeRadius, setActiveRadius] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const geoRef = useRef(userLocation);
  geoRef.current = userLocation;

  const loadStock = useCallback(async (f: VehicleFilters, loc: typeof userLocation, radius: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const extra: VehicleFilters = loc ? { lat: loc.lat, lng: loc.lng, ...(radius != null ? { radius_km: radius } : {}) } : {};
      setResult(await vehicleService.listNetwork({ ...f, ...extra }));
    } catch {
      setError("Error al cargar los vehículos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "stock") loadStock(filters, userLocation, activeRadius);
  }, [tab, filters, userLocation, activeRadius, loadStock]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) { toast.error("Tu navegador no soporta geolocalización."); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveGeoCache(loc.lat, loc.lng);
        setUserLocation(loc);
        setGeoLoading(false);
        toast.success("Ubicación detectada. Mostrando vehículos cercanos.");
      },
      () => { setGeoLoading(false); toast.error("No se pudo obtener la ubicación."); },
      { timeout: 8000, maximumAge: 60000 },
    );
  };

  const clearGeo = () => {
    localStorage.removeItem(GEO_CACHE_KEY);
    setUserLocation(null);
    setActiveRadius(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Mercado</h1>

      <TabToggle active={tab} onChange={setTab} />

      {tab === "stock" && (
        <>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <FilterBar filters={filters} onChange={setFilters} />
            </div>
            <button
              onClick={userLocation ? clearGeo : handleGeolocate}
              disabled={geoLoading}
              title={userLocation ? "Quitar ubicación" : "Usar mi ubicación"}
              className={`shrink-0 p-2 rounded-xl text-sm font-semibold border transition-colors ${
                userLocation
                  ? "bg-blue-50 border-blue-200 text-blue-600"
                  : "bg-gray-100 border-gray-200 text-gray-500"
              } disabled:opacity-50`}
            >
              {geoLoading ? <Spinner /> : "📍"}
            </button>
          </div>

          {userLocation && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setActiveRadius(opt.value)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    activeRadius === opt.value
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

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
