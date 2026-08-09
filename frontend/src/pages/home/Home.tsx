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

const fmt = (n: number) => Number(n).toLocaleString("es-AR");

function MatchCard({ item, index, total, onAccept, onReject }: {
  item: InboxItem;
  index: number;
  total: number;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand bg-surface">
      <div className="flex items-center gap-2 bg-brand px-4 py-2.5">
        <span className="h-[7px] w-[7px] rounded-full bg-white" />
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-white">
          Match directo de La Lonja
        </span>
        <span className="ml-auto font-mono text-[11px] text-white/75">{index + 1} de {total}</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-[13.5px] leading-snug text-muted">
          <span className="font-semibold text-ink">{item.offering_company_name}</span> ofrece de contado por tu{" "}
          <span className="font-semibold text-ink">{item.vehicle_label}</span>
        </p>
        <p className="mt-1.5 font-mono text-[28px] font-bold leading-none tracking-tight text-ink">
          USD {fmt(item.vehicle_price)}
        </p>
        {item.rank_score != null && (
          <div className="mt-2.5 flex gap-3.5 font-mono text-[12px] text-faint">
            <span>SCORE {Math.round(Number(item.rank_score))}</span>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onAccept(item.offer_id)}
            className="flex-[1.2] rounded-[10px] bg-brand py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Aceptar oferta
          </button>
          <button
            onClick={() => onReject(item.offer_id)}
            className="flex-1 rounded-[10px] border border-line py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            Rechazar
          </button>
          {item.whatsapp_url && (
            <a
              href={item.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir WhatsApp"
              className="flex w-14 items-center justify-center rounded-[10px] border border-line text-brand transition-colors hover:bg-mint"
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
              </svg>
            </a>
          )}
        </div>
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

const ALERT_TONE: Record<string, { bg: string; dot: string }> = {
  pre_toma: { bg: "bg-mint", dot: "bg-brand" },
  pre_toma_interest: { bg: "bg-mint", dot: "bg-brand" },
  direct_match: { bg: "bg-mint", dot: "bg-brand" },
  favorite_request: { bg: "bg-warn-bg", dot: "bg-amber-600" },
  favorite_accepted: { bg: "bg-mint", dot: "bg-brand" },
  rating_pending: { bg: "bg-warn-bg", dot: "bg-amber-600" },
};

function SectionLabel({ children, action, onAction }: { children: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{children}</span>
      {action && (
        <button onClick={onAction} className="text-[12.5px] font-semibold text-brand">{action}</button>
      )}
    </div>
  );
}

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

  const statCards = [
    { label: "Consultas recibidas", value: stats.consultas_recibidas, mint: false },
    { label: "Ofertas pendientes", value: stats.ofertas_pendientes, mint: false },
    { label: "Match directos", value: stats.match_directos, mint: true },
    { label: "Vehículos publicados", value: stats.vehiculos_publicados, mint: false },
  ];

  const pending = inbox.length;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="flex items-baseline gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">
          Hola, {user?.full_name?.split(" ")[0] ?? ""}
        </h1>
        <span className="text-[13px] text-faint">
          {pending > 0 ? `${pending} ${pending === 1 ? "decisión te espera" : "decisiones te esperan"}` : "Todo al día"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        {/* Left column — matches */}
        <div className="space-y-4">
          {inbox.length > 0 ? (
            inbox.map((item, i) => (
              <MatchCard
                key={item.id}
                item={item}
                index={i}
                total={inbox.length}
                onAccept={(id) => handleOfferAction(id, "accepted")}
                onReject={(id) => handleOfferAction(id, "rejected")}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-8 text-center">
              <p className="text-sm font-semibold text-ink-soft">No hay match directos pendientes</p>
              <p className="mt-1 text-xs text-faint">Las ofertas de La Lonja aparecerán acá.</p>
            </div>
          )}

          {/* Quick access (mobile-friendly) */}
          <div className="grid grid-cols-2 gap-3 lg:hidden">
            <button
              onClick={() => navigate("/mercado")}
              className="rounded-2xl bg-brand px-4 py-3.5 text-left text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              Ver Mercado
            </button>
            <button
              onClick={() => navigate("/lonja")}
              className="rounded-2xl bg-ink px-4 py-3.5 text-left text-sm font-semibold text-white transition-colors hover:opacity-90"
            >
              La Lonja
            </button>
          </div>
        </div>

        {/* Right column — stats + alerts */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            {statCards.map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border p-3.5 ${s.mint ? "border-mint-border bg-mint" : "border-line bg-surface"}`}
              >
                <div className={`font-mono text-[26px] font-bold leading-none ${s.mint ? "text-brand" : "text-ink"}`}>
                  {s.value}
                </div>
                <div className={`mt-1.5 text-[11.5px] ${s.mint ? "text-mint-ink" : "text-faint"}`}>{s.label}</div>
              </div>
            ))}
          </div>

          <div>
            <SectionLabel>Alertas y novedades</SectionLabel>
            {alerts.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                {alerts.slice(0, 6).map((n) => {
                  const tone = ALERT_TONE[n.entity_type ?? ""] ?? { bg: "bg-tab", dot: "bg-faint" };
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleAlertClick(n)}
                      className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-canvas"
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${tone.bg}`}>
                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-semibold leading-snug text-ink">{n.title}</span>
                        {n.body && <span className="mt-0.5 block truncate text-[11.5px] text-faint">{n.body}</span>}
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-brand">Ver</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-surface p-6 text-center">
                <p className="text-sm font-medium text-ink-soft">Sin alertas pendientes</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
