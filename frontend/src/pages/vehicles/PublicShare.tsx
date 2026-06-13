import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { vehicleService } from "../../services/vehicleService";
import type { VehiclePublic } from "../../types/vehicle";

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Nafta", diesel: "Diesel", electric: "Eléctrico", hybrid: "Híbrido", gnc: "GNC",
};

export function PublicShare() {
  const { token } = useParams<{ token: string }>();
  const [vehicle, setVehicle] = useState<VehiclePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!token) return;
    vehicleService.getPublic(token)
      .then(setVehicle)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
        <div style={{ color: "#6b7280" }}>Cargando...</div>
      </div>
    );
  }

  if (notFound || !vehicle) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Vehículo no encontrado</h1>
        <p style={{ color: "#6b7280" }}>Este link puede haber expirado o ser inválido.</p>
      </div>
    );
  }

  const images = vehicle.images ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <div style={{ background: "#1e3a8a", padding: "14px 24px", marginBottom: 0 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", color: "#fff", fontWeight: 700, fontSize: 18 }}>Reventa</div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <div>
            <div style={{ width: "100%", aspectRatio: "4/3", background: "#e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
              {images[activeImg] ? (
                <img src={images[activeImg].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>Sin imagen</div>
              )}
            </div>
            {images.length > 1 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {images.map((img, i) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt=""
                    onClick={() => setActiveImg(i)}
                    style={{
                      width: 60, height: 44, objectFit: "cover", borderRadius: 5, cursor: "pointer",
                      border: i === activeImg ? "2px solid #1d4ed8" : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px" }}>
              {vehicle.brand} {vehicle.model} {vehicle.year}
            </h1>
            {vehicle.version && <div style={{ color: "#6b7280", marginBottom: 14 }}>{vehicle.version}</div>}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
              {[
                `${vehicle.mileage.toLocaleString()} km`,
                FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type,
                vehicle.transmission === "manual" ? "Manual" : "Automático",
                vehicle.condition === "new" ? "Nuevo" : "Usado",
                vehicle.body_type,
                vehicle.color,
              ].filter(Boolean).map((tag) => (
                <span key={tag} style={{ background: "#e5e7eb", borderRadius: 6, padding: "3px 10px", fontSize: 13 }}>{tag}</span>
              ))}
            </div>

            {vehicle.description && (
              <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.65 }}>{vehicle.description}</p>
            )}

            <div style={{ marginTop: 20, padding: "12px 16px", background: "#eff6ff", borderRadius: 8, color: "#1d4ed8", fontSize: 13 }}>
              ¿Interesado? Contactá a tu concesionaria de confianza.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
