import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { notificationService, type AppNotification } from "@/services/notificationService";

interface HomeStats {
  consultas_recibidas: number;
  ofertas_pendientes: number;
  match_directos: number;
  vehiculos_publicados: number;
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

const ALERT_ICON: Record<string, string> = {
  pre_toma: "🚗",
  pre_toma_interest: "⭐",
  favorite_request: "🤝",
  favorite_accepted: "✅",
  direct_match: "🎯",
};

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats] = useState<HomeStats>({
    consultas_recibidas: 0,
    ofertas_pendientes: 0,
    match_directos: 0,
    vehiculos_publicados: 0,
  });
  const [alerts, setAlerts] = useState<AppNotification[]>([]);

  useEffect(() => {
    notificationService.list().then(setAlerts).catch(() => {});
  }, []);

  const handleAlertClick = (n: AppNotification) => {
    notificationService.markRead(n.id).catch(() => {});
    if (n.entity_type === "pre_toma" || n.entity_type === "pre_toma_interest") navigate("/mercado");
    else if (n.entity_type?.startsWith("favorite")) navigate("/agencia");
    else if (n.entity_type === "direct_match") navigate("/lonja");
  };

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Hola, {user?.full_name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500">Resumen de actividad reciente</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Consultas", value: stats.consultas_recibidas },
          { label: "Ofertas", value: stats.ofertas_pendientes },
          { label: "Matches", value: stats.match_directos },
          { label: "En stock", value: stats.vehiculos_publicados },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/mercado")}
          className="bg-green-600 text-white rounded-xl px-4 py-3 text-sm font-semibold text-left shadow-sm active:bg-green-700"
        >
          <span className="block text-lg mb-0.5">🛒</span>
          Ver Mercado
        </button>
        <button
          onClick={() => navigate("/lonja")}
          className="bg-gray-900 text-white rounded-xl px-4 py-3 text-sm font-semibold text-left shadow-sm active:bg-gray-800"
        >
          <span className="block text-lg mb-0.5">📋</span>
          La Lonja
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-800">Alertas y novedades</h2>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 6).map((n) => (
              <button
                key={n.id}
                onClick={() => handleAlertClick(n)}
                className={`w-full text-left bg-white rounded-xl px-4 py-3 shadow-sm flex items-start gap-3 active:bg-gray-50 ${!n.is_read ? "border-l-4 border-green-500" : ""}`}
              >
                <span className="text-xl shrink-0">{ALERT_ICON[n.entity_type ?? ""] ?? "🔔"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 leading-snug">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm font-medium text-gray-700">Todo al día</p>
          <p className="text-xs text-gray-400 mt-1">No tenés alertas pendientes</p>
        </div>
      )}
    </div>
  );
}
