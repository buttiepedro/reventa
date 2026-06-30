import { Link } from "react-router-dom";
import type { VehicleListItem } from "@/types/vehicle";

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
};

const STATUS_CLASSES: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  reserved: "bg-yellow-100 text-yellow-800",
  sold: "bg-red-100 text-red-800",
};

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Nafta",
  diesel: "Diesel",
  electric: "Eléctrico",
  hybrid: "Híbrido",
  gnc: "GNC",
};

interface Props {
  vehicle: VehicleListItem;
  showPreTomaActions?: boolean;
}

export function VehicleCard({ vehicle, showPreTomaActions: _showPreTomaActions }: Props) {
  return (
    <Link to={`/vehicles/${vehicle.id}`} className="block group">
      <div className={`bg-white rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow ${
        vehicle.is_favorite_company ? "ring-2 ring-blue-500" : "border border-gray-100"
      }`}>
        {/* Image */}
        <div className="relative aspect-video bg-gray-100">
          {vehicle.primary_image_url ? (
            <img
              src={vehicle.primary_image_url}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin imagen</div>
          )}
          <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[vehicle.status] ?? "bg-gray-100 text-gray-700"}`}>
            {STATUS_LABELS[vehicle.status] ?? vehicle.status}
          </span>
          {vehicle.is_favorite_company && (
            <span className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
              ★ Favorita
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5">
          <p className="font-bold text-gray-900 text-base leading-tight">
            {vehicle.brand} {vehicle.model} <span className="font-normal text-gray-500">{vehicle.year}</span>
          </p>
          {vehicle.version && (
            <p className="text-xs text-gray-500 mt-0.5">{vehicle.version}</p>
          )}
          <div className="flex gap-2 flex-wrap mt-2 text-xs text-gray-600">
            <span>{vehicle.mileage.toLocaleString()} km</span>
            <span>·</span>
            <span>{FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type}</span>
            <span>·</span>
            <span>{vehicle.transmission === "manual" ? "Manual" : "Automático"}</span>
          </div>
          <div className="flex justify-between items-end mt-3">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Reventa</p>
              <p className="font-bold text-blue-600 text-lg leading-none">
                ${Number(vehicle.price_resale).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Público</p>
              <p className="font-semibold text-gray-700 text-sm">
                ${Number(vehicle.price_public).toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{vehicle.company_name}</p>
        </div>
      </div>
    </Link>
  );
}
