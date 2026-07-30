import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { notificationService, type AppNotification } from "@/services/notificationService";
import { RatingModal } from "@/components/RatingModal";

interface InboxItem {
  id: string;
  type: string;
  offering_company_name: string;
  offering_company_phone: string | null;
  whatsapp_url: string | null;
  vehicle_label: string;
  vehicle_price: number;
  offer_id: string;
  rank_score: number | null;
  created_at: string;
}

function MatchCard({ item, onAccept, onReject }: { item: InboxItem; onAccept: (id: string) => void; onReject: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-green-100 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Oferta en La Lonja</p>
          <p className="font-bold text-gray-900 text-sm leading-snug">{item.vehicle_label}</p>
          <p className="text-xs text-gray-500">{item.offering_company_name} · ${Number(item.vehicle_price).toLocaleString()}</p>
        </div>
        {item.rank_score != null && (
          <span className="shrink-0 text-xs font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
            {Math.round(Number(item.rank_score))} pts
          </span>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onAccept(item.offer_id)}
          className="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg"
        >
          Aceptar
        </button>
        <button
          onClick={() => onReject(item.offer_id)}
          className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg"
        >
          Rechazar
        </button>
        {item.whatsapp_url && (
          <a
            href={item.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-[#25D366] text-white text-xs font-semibold rounded-lg flex items-center gap-1"
          >
            WA
          </a>
        )}
      </div>
    </div>
  );
}

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
  rating_pending: "⭐",
};

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats>({
    consultas_recibidas: 0,
    ofertas_pendientes: 0,
    match_directos: 0,
    vehiculos_publicados: 0,
  });
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [ratingModal, setRatingModal] = useState<{ offerId: string; companyId: string; companyName: string } | null>(null);

  const loadData = () => {
    notificationService.list().then(setAlerts).catch(() => {});
    api.get<HomeStats>("/home/stats").then(setStats).catch(() => {});
    api.get<InboxItem[]>("/home/inbox").then(setInbox).catch(() => {});
  };

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleOfferAction = async (offerId: string, action: "accepted" | "rejected") => {
    try {
      await api.patch(`/lonja/offers/${offerId}?new_status=${action}`, {});
      setInbox((prev) => prev.filter((i) => i.offer_id !== offerId));
      toast.success(action === "accepted" ? "Oferta aceptada" : "Oferta rechazada");
      loadData();
    } catch {
      toast.error("Error al procesar la oferta.");
    }
  };

  const handleAlertClick = (n: AppNotification) => {
    notificationService.markRead(n.id).catch(() => {});
    if (n.entity_type === "rating_pending" && n.entity_id) {
      setRatingModal({ offerId: n.entity_id, companyId: "", companyName: "la otra agencia" });
      return;
    }
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

      {/* Inbox — pending Lonja offers */}
      {inbox.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Ofertas pendientes en La Lonja</h2>
          <div className="space-y-2">
            {inbox.map((item) => (
              <MatchCard
                key={item.id}
                item={item}
                onAccept={(id) => handleOfferAction(id, "accepted")}
                onReject={(id) => handleOfferAction(id, "rejected")}
              />
            ))}
          </div>
        </div>
      )}

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

      {ratingModal && (
        <RatingModal
          offerId={ratingModal.offerId}
          ratedCompanyId={ratingModal.companyId}
          ratedCompanyName={ratingModal.companyName}
          onClose={() => setRatingModal(null)}
        />
      )}
    </div>
  );
}
