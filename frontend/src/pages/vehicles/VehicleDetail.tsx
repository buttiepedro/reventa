import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { vehicleService } from "../../services/vehicleService";
import { ImageUploader } from "../../components/vehicles/ImageUploader";
import { useAuth } from "../../hooks/useAuth";
import type { Vehicle } from "../../types/vehicle";

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Nafta", diesel: "Diesel", electric: "Eléctrico", hybrid: "Híbrido", gnc: "GNC",
};

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setVehicle(await vehicleService.get(id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const isOwner = user && vehicle && user.company_id === vehicle.company_id;
  const canEdit = isOwner || user?.role === "super_admin";

  const copyShareLink = () => {
    if (!vehicle) return;
    const url = `${window.location.origin}/share/${vehicle.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!id) return;
    await vehicleService.setPrimaryImage(id, imageId);
    load();
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!id || !window.confirm("¿Eliminar esta imagen?")) return;
    await vehicleService.deleteImage(id, imageId);
    load();
  };

  if (loading) return <div style={{ color: "#6b7280", padding: 40 }}>Cargando...</div>;
  if (!vehicle) return <div style={{ color: "#dc2626", padding: 40 }}>Vehículo no encontrado.</div>;

  const images = vehicle.images ?? [];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 0 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 14 }}>
          ← Volver
        </button>
        {canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link to={`/vehicles/${id}/edit`} style={btnStyle("#eff6ff", "#2563eb")}>Editar</Link>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {/* Gallery */}
        <div>
          <div style={{ width: "100%", aspectRatio: "4/3", background: "#f3f4f6", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
            {images[activeImg] ? (
              <img src={images[activeImg].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>Sin imagen</div>
            )}
          </div>
          {images.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {images.map((img, i) => (
                <div key={img.id} style={{ position: "relative" }}>
                  <img
                    src={img.url}
                    alt=""
                    onClick={() => setActiveImg(i)}
                    style={{
                      width: 64, height: 48, objectFit: "cover", borderRadius: 6, cursor: "pointer",
                      border: i === activeImg ? "2px solid #2563eb" : "2px solid transparent",
                    }}
                  />
                  {img.is_primary && (
                    <span style={{ position: "absolute", top: 2, left: 2, background: "#2563eb", color: "#fff", fontSize: 9, padding: "1px 4px", borderRadius: 4 }}>★</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <ImageUploader vehicleId={vehicle.id} onUploaded={load} />
              {images.length > 0 && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {images.map((img, i) => (
                    <span key={img.id} style={{ marginRight: 8 }}>
                      <button onClick={() => handleSetPrimary(img.id)} style={{ fontSize: 11, background: "none", border: "none", color: "#2563eb", cursor: "pointer" }}>
                        {img.is_primary ? "★ Principal" : "Hacer principal"}
                      </button>
                      {" · "}
                      <button onClick={() => handleDeleteImage(img.id)} style={{ fontSize: 11, background: "none", border: "none", color: "#dc2626", cursor: "pointer" }}>
                        Eliminar {i + 1}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{vehicle.company_name}</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>
            {vehicle.brand} {vehicle.model} {vehicle.year}
          </h1>
          {vehicle.version && <div style={{ color: "#6b7280", marginBottom: 12 }}>{vehicle.version}</div>}

          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <Tag>{vehicle.mileage.toLocaleString()} km</Tag>
            <Tag>{FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type}</Tag>
            <Tag>{vehicle.transmission === "manual" ? "Manual" : "Automático"}</Tag>
            <Tag>{vehicle.condition === "new" ? "Nuevo" : "Usado"}</Tag>
            {vehicle.body_type && <Tag>{vehicle.body_type}</Tag>}
            <Tag>{vehicle.color}</Tag>
          </div>

          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Precio reventa</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1d4ed8" }}>
                ${Number(vehicle.price_resale).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Precio público</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#374151" }}>
                ${Number(vehicle.price_public).toLocaleString()}
              </div>
            </div>
          </div>

          {vehicle.description && (
            <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{vehicle.description}</p>
          )}

          <button
            onClick={copyShareLink}
            style={{ padding: "9px 18px", background: copied ? "#16a34a" : "#f3f4f6", color: copied ? "#fff" : "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
          >
            {copied ? "¡Link copiado!" : "Copiar link público"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "3px 10px", fontSize: 13, color: "#374151" }}>
      {children}
    </span>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return { padding: "7px 14px", background: bg, color, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500, textDecoration: "none" };
}
