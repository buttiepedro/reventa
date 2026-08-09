import { Link } from "react-router-dom";
import { useAudience } from "@/context/AudienceContext";
import type { VehicleListItem } from "@/types/vehicle";

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
};

const STATUS_CLASSES: Record<string, string> = {
  available: "bg-mint text-brand",
  reserved: "bg-warn-bg text-amber-700",
  sold: "bg-red-50 text-red-600",
};

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Nafta",
  diesel: "Diésel",
  electric: "Eléctrico",
  hybrid: "Híbrido",
  gnc: "GNC",
};

const money = (n: number | string) => Number(n).toLocaleString("es-AR");

interface Props {
  vehicle: VehicleListItem;
  showPreTomaActions?: boolean;
}

export function VehicleCard({ vehicle, showPreTomaActions: _showPreTomaActions }: Props) {
  const { isClientMode } = useAudience();
  return (
    <Link to={`/vehicles/${vehicle.id}`} className="block">
      <div className={`vehicle-card-hover overflow-hidden rounded-2xl bg-surface transition-[transform,box-shadow] duration-200 ease-out ${
        vehicle.is_favorite_company ? "ring-1 ring-brand" : "border border-line"
      }`}>
        {/* Image */}
        <div className="relative aspect-video bg-canvas">
          {vehicle.primary_image_url ? (
            <img
              src={vehicle.primary_image_url}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center photo-hatch font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
              Sin foto
            </div>
          )}
          <span className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[vehicle.status] ?? "bg-tab text-muted"}`}>
            {STATUS_LABELS[vehicle.status] ?? vehicle.status}
          </span>
          {vehicle.is_favorite_company && (
            <span className="absolute left-2 top-2 rounded-md bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
              ★ Favorita
            </span>
          )}
          {vehicle.distance_km != null && (
            <span className="absolute bottom-2 right-2 rounded-md bg-ink/70 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
              {vehicle.distance_km < 1 ? "< 1 km" : `${Math.round(vehicle.distance_km)} km`}
            </span>
          )}
          {vehicle.is_liquidacion && (
            <span className="absolute bottom-2 left-2 rounded-md bg-red-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              LIQUIDACIÓN
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5">
          <p className="text-base font-semibold leading-tight text-ink">
            {vehicle.brand} {vehicle.model} <span className="font-mono text-sm font-normal text-faint">{vehicle.year}</span>
          </p>
          {vehicle.version && (
            <p className="mt-0.5 text-xs text-faint">{vehicle.version}</p>
          )}
          <div className="mt-2 font-mono text-[11.5px] text-faint">
            {money(vehicle.mileage)} km · {FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type} · {vehicle.transmission === "manual" ? "Manual" : "Automático"}
          </div>
          <div className="mt-3 flex items-end justify-between">
            {!isClientMode && (
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">Reventa</p>
                {vehicle.is_liquidacion && vehicle.liquidacion_price ? (
                  <>
                    <p className="font-mono text-xs leading-tight text-faint line-through">USD {money(vehicle.price_resale)}</p>
                    <p className="font-mono text-lg font-bold leading-none text-red-600">USD {money(vehicle.liquidacion_price)}</p>
                  </>
                ) : (
                  <p className="font-mono text-lg font-bold leading-none text-ink">USD {money(vehicle.price_resale)}</p>
                )}
              </div>
            )}
            <div className={isClientMode ? "" : "text-right"}>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">Precio</p>
              <p className={`font-mono font-bold leading-none ${isClientMode ? "text-lg text-brand" : "text-sm text-muted"}`}>
                USD {money(vehicle.price_public)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-faint">{isClientMode ? "Agencia verificada" : vehicle.company_name}</p>
        </div>
      </div>
    </Link>
  );
}
