import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

interface VehicleDetail {
  id: string;
  brand: string;
  model: string;
  year: number;
  km: number;
  price_toma: number;
  price_resale: number;
  status: string;
  created_at: string;
  images: { id: string; url: string; is_primary: boolean }[];
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pre_toma: { label: "Pre-Toma pendiente", color: "#92400e", bg: "#fef3c7" },
  available: { label: "Publicado en red", color: "#166534", bg: "#dcfce7" },
  sold: { label: "Vendido", color: "#1e3a5f", bg: "#dbeafe" },
};

export function ExpressDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<VehicleDetail>(`/vehicles/${id}`)
      .then(setVehicle)
      .catch(() => navigate("/", { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--gray-400)" }}>Cargando...</p>
      </div>
    );
  }

  if (!vehicle) return null;

  const statusInfo = STATUS_LABEL[vehicle.status] ?? { label: vehicle.status, color: "#374151", bg: "#f3f4f6" };
  const primaryImg = vehicle.images?.find((i) => i.is_primary) ?? vehicle.images?.[0];

  return (
    <div className="screen">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/")} style={{ fontSize: 22, color: "var(--gray-700)", padding: 4 }}>←</button>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: "var(--gray-900)" }}>Detalle Pre-Toma</h1>
      </div>

      {primaryImg && (
        <img src={primaryImg.url} alt="" style={{ width: "100%", borderRadius: 16, objectFit: "cover", maxHeight: 220 }} />
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)" }}>
              {vehicle.brand} {vehicle.model}
            </p>
            <p style={{ fontSize: 14, color: "var(--gray-500)" }}>{vehicle.year}</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99, background: statusInfo.bg, color: statusInfo.color }}>
            {statusInfo.label}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            ["Kilometraje", `${Number(vehicle.km ?? 0).toLocaleString()} km`],
            ["Precio toma", `$${Number(vehicle.price_resale).toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label}>
              <p style={{ fontSize: 11, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)", marginTop: 2 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-secondary" onClick={() => navigate("/")}>
        ← Volver al inicio
      </button>
    </div>
  );
}
