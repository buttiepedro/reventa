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

// Argentine plate patterns: ABC123 (old) or AB123CD (Mercosur)
const PLATE_RE = /^[A-Za-z]{2,3}[-\s]?\d{3}[-\s]?[A-Za-z]{0,2}$/;

type SearchMode = "text" | "budget" | "plate" | null;

function detectMode(q: string): SearchMode {
  if (!q.trim()) return null;
  const clean = q.trim().replace(/[.,\s]/g, "");
  if (/^\d+$/.test(clean)) return "budget";
  if (PLATE_RE.test(q.trim())) return "plate";
  return "text";
}

function SmartSearch({ onSearch }: { onSearch: (mode: SearchMode, value: string) => void }) {
  const [query, setQuery] = useState("");
  const mode = detectMode(query);

  const hints: Record<NonNullable<SearchMode>, string> = {
    budget: "Buscando vehículos dentro de ese presupuesto (±15%)",
    plate: "Buscando por dominio/patente",
    text: "Buscando por marca y modelo",
  };

  const handleChange = (val: string) => {
    setQuery(val);
    onSearch(detectMode(val), val.trim());
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Buscar marca, modelo, patente o presupuesto..."
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {mode && (
        <p className="mt-1 text-[11px] text-gray-400 pl-1">{hints[mode]}</p>
      )}
    </div>
  );
}

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

  const [searchExtra, setSearchExtra] = useState<VehicleFilters>({});

  const handleSearch = useCallback((mode: SearchMode, value: string) => {
    if (!value) { setSearchExtra({}); return; }
    if (mode === "budget") {
      const n = parseInt(value.replace(/[.,\s]/g, ""), 10);
      setSearchExtra(isNaN(n) ? {} : { budget: n });
    } else if (mode === "plate") {
      setSearchExtra({ plate: value });
    } else {
      // text: split into brand/model guess — just use model field for simplicity
      setSearchExtra({ model: value });
    }
  }, []);

  const loadStock = useCallback(async (f: VehicleFilters, loc: typeof userLocation, radius: number | null, extra: VehicleFilters) => {
    setLoading(true);
    setError(null);
    try {
      const geoExtra: VehicleFilters = loc ? { lat: loc.lat, lng: loc.lng, ...(radius != null ? { radius_km: radius } : {}) } : {};
      setResult(await vehicleService.listNetwork({ ...f, ...geoExtra, ...extra }));
    } catch {
      setError("Error al cargar los vehículos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "stock") loadStock(filters, userLocation, activeRadius, searchExtra);
  }, [tab, filters, userLocation, activeRadius, searchExtra, loadStock]);

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
          <SmartSearch onSearch={handleSearch} />
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
