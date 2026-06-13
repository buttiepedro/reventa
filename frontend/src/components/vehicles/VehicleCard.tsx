import { Link } from "react-router-dom";
import type { VehicleListItem } from "../../types/vehicle";

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
};

const STATUS_COLORS: Record<string, string> = {
  available: "#16a34a",
  reserved: "#d97706",
  sold: "#dc2626",
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
}

export function VehicleCard({ vehicle }: Props) {
  return (
    <Link
      to={`/vehicles/${vehicle.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          border: vehicle.is_favorite_company ? "2px solid #2563eb" : "1px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
          transition: "box-shadow 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "none")}
      >
        <div style={{ position: "relative", height: 180, background: "#f3f4f6" }}>
          {vehicle.primary_image_url ? (
            <img
              src={vehicle.primary_image_url}
              alt={`${vehicle.brand} ${vehicle.model}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: 14 }}>
              Sin imagen
            </div>
          )}
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: STATUS_COLORS[vehicle.status] ?? "#6b7280",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {STATUS_LABELS[vehicle.status] ?? vehicle.status}
          </span>
          {vehicle.is_favorite_company && (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "#2563eb",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              ★ Favorita
            </span>
          )}
        </div>

        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {vehicle.brand} {vehicle.model} {vehicle.year}
          </div>
          {vehicle.version && (
            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>{vehicle.version}</div>
          )}
          <div style={{ color: "#374151", fontSize: 13, marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{vehicle.mileage.toLocaleString()} km</span>
            <span>{FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type}</span>
            <span>{vehicle.transmission === "manual" ? "Manual" : "Automático"}</span>
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Reventa</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1d4ed8" }}>
                ${Number(vehicle.price_resale).toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Público</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#374151" }}>
                ${Number(vehicle.price_public).toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>{vehicle.company_name}</div>
        </div>
      </div>
    </Link>
  );
}
