import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { logout, getUser } from "../auth";

interface PreToma {
  id: string;
  brand: string;
  model: string;
  year: number;
  km: number;
  price_toma: number;
  status: string;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

const STATUS_LABEL: Record<string, string> = {
  pre_toma: "Pendiente",
  available: "Publicado",
  sold: "Vendido",
};

export function DashboardMobile() {
  const navigate = useNavigate();
  const user = getUser();
  const [items, setItems] = useState<PreToma[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get<{ items: PreToma[]; total: number }>("/vehicles/my?page=1&page_size=20")
      .then((r) => setItems((r as unknown as PreToma[]).filter ? (r as unknown as PreToma[]) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)" }}>
            Hola, {user?.full_name?.split(" ")[0]} 👋
          </h1>
          <p style={{ fontSize: 13, color: "var(--gray-500)" }}>Pre-Tomas cargadas</p>
        </div>
        <button onClick={handleLogout} style={{ fontSize: 13, color: "var(--gray-400)" }}>
          Salir
        </button>
      </div>

      <button
        className="btn-primary"
        onClick={() => navigate("/express/new")}
        style={{ fontSize: 18, padding: "18px 14px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <span>+</span> Nueva Pre-Toma
      </button>

      {loading ? (
        <p style={{ textAlign: "center", color: "var(--gray-400)", padding: "32px 0" }}>Cargando...</p>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 16px" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-700)" }}>Sin pre-tomas aún</p>
          <p style={{ fontSize: 13, color: "var(--gray-400)", marginTop: 4 }}>Tocá el botón para cargar la primera</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => (
            <button
              key={item.id}
              className="card"
              onClick={() => navigate(`/express/${item.id}`)}
              style={{ textAlign: "left", width: "100%" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontWeight: 700, color: "var(--gray-900)", fontSize: 15 }}>
                    {item.brand} {item.model} {item.year}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 2 }}>
                    {item.km?.toLocaleString()} km · ${Number(item.price_toma ?? 0).toLocaleString()}
                  </p>
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 99,
                  background: item.status === "pre_toma" ? "#fef3c7" : "#dcfce7",
                  color: item.status === "pre_toma" ? "#92400e" : "#166534",
                }}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 6 }}>{timeAgo(item.created_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
