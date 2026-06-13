import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { vehicleService } from "../../services/vehicleService";
import type { VehicleListItem, VehicleStatus } from "../../types/vehicle";

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
};

const STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Reservado" },
  { value: "sold", label: "Vendido" },
];

export function MyStock() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setVehicles(await vehicleService.listMy());
    } catch {
      setError("Error al cargar tu stock.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este vehículo?")) return;
    try {
      await vehicleService.delete(id);
      setVehicles((vs) => vs.filter((v) => v.id !== id));
    } catch {
      alert("Error al eliminar el vehículo.");
    }
  };

  const handleStatusChange = async (id: string, status: VehicleStatus) => {
    try {
      const updated = await vehicleService.updateStatus(id, status);
      setVehicles((vs) => vs.map((v) => (v.id === id ? { ...v, status: updated.status } : v)));
    } catch {
      alert("Error al cambiar el estado.");
    }
  };

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Mi stock</h2>
        <Link
          to="/vehicles/new"
          style={{ padding: "8px 18px", background: "#2563eb", color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: 14 }}
        >
          + Nuevo vehículo
        </Link>
      </div>

      {loading && <div style={{ color: "#6b7280" }}>Cargando...</div>}
      {error && <div style={{ color: "#dc2626" }}>{error}</div>}

      {!loading && !error && vehicles.length === 0 && (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "60px 0" }}>
          Todavía no tenés vehículos. <Link to="/vehicles/new">Agregá el primero.</Link>
        </div>
      )}

      {!loading && vehicles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {vehicles.map((v) => (
            <div
              key={v.id}
              style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 18px", background: "#fff", display: "flex", gap: 16, alignItems: "center" }}
            >
              <div style={{ width: 80, height: 60, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "#f3f4f6" }}>
                {v.primary_image_url ? (
                  <img src={v.primary_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 11, color: "#9ca3af" }}>Sin img</div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{v.brand} {v.model} {v.year}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{v.mileage.toLocaleString()} km · ${Number(v.price_resale).toLocaleString()}</div>
              </div>

              <select
                value={v.status}
                onChange={(e) => handleStatusChange(v.id, e.target.value as VehicleStatus)}
                style={{ padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => navigate(`/vehicles/${v.id}`)} style={actionBtn("#f3f4f6", "#374151")}>Ver</button>
                <button onClick={() => navigate(`/vehicles/${v.id}/edit`)} style={actionBtn("#eff6ff", "#2563eb")}>Editar</button>
                <button onClick={() => handleDelete(v.id)} style={actionBtn("#fef2f2", "#dc2626")}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function actionBtn(bg: string, color: string): React.CSSProperties {
  return { padding: "6px 12px", background: bg, color, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 };
}
